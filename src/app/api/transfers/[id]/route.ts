import { z } from "zod";
import { holderLabel } from "@/lib/allocations";
import { handle, fail, ok } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { notify, notifyMany } from "@/lib/notifications";
import { requireRole } from "@/lib/rbac";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
});

const transferInclude = {
  asset: { select: { id: true, name: true, assetTag: true } },
  fromEmployee: { select: { id: true, name: true, email: true } },
  toEmployee: { select: { id: true, name: true, email: true } },
  requestedBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true } },
} as const;

export const PATCH = handle(async (req, ctx) => {
  const session = await requireRole("ASSET_MANAGER", "DEPARTMENT_HEAD");
  const { id } = await ctx.params;
  const body = schema.parse(await req.json());

  const transfer = await prisma.transfer.findUnique({
    where: { id },
    include: transferInclude,
  });

  if (!transfer) return fail("Transfer not found", 404);
  if (transfer.status !== "REQUESTED") return fail("Transfer has already been decided", 409);

  if (body.action === "reject") {
    const rejected = await prisma.transfer.update({
      where: { id },
      data: { status: "REJECTED", approvedById: session.sub },
      include: transferInclude,
    });

    await logActivity(session.sub, "TRANSFER_REJECTED", "Transfer", id, {
      assetTag: transfer.asset.assetTag,
      to: transfer.toEmployee.name,
    });
    await notify(
      transfer.requestedBy.id,
      "TRANSFER_APPROVED",
      `${transfer.asset.name} (${transfer.asset.assetTag}) transfer request was rejected.`,
      { title: "Transfer rejected", linkUrl: "/allocations" }
    );

    return ok(rejected);
  }

  const active = await prisma.allocation.findFirst({
    where: { assetId: transfer.asset.id, status: "ACTIVE" },
    include: {
      holder: { select: { id: true, name: true, email: true } },
      department: { select: { id: true, name: true } },
    },
  });

  if (!active) return fail("No active allocation exists for this asset", 409);

  const completed = await prisma.$transaction(async (tx: any) => {
    await tx.allocation.update({
      where: { id: active.id },
      data: {
        status: "RETURNED",
        returnedAt: new Date(),
        checkInNotes: "Closed by approved transfer",
      },
    });
    await tx.allocation.create({
      data: {
        assetId: transfer.asset.id,
        holderId: transfer.toEmployee.id,
        allocatedById: session.sub,
      },
    });

    return tx.transfer.update({
      where: { id },
      data: { status: "COMPLETED", approvedById: session.sub },
      include: transferInclude,
    });
  });

  await logActivity(session.sub, "TRANSFER_APPROVED", "Transfer", id, {
    assetTag: transfer.asset.assetTag,
    from: holderLabel(active),
    to: transfer.toEmployee.name,
  });
  await notifyMany(
    [transfer.requestedBy.id, transfer.toEmployee.id],
    "TRANSFER_APPROVED",
    `${transfer.asset.name} (${transfer.asset.assetTag}) transfer to ${transfer.toEmployee.name} was approved.`,
    { linkUrl: "/allocations" }
  );

  return ok(completed);
});
