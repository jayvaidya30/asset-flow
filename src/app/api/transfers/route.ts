import { z } from "zod";
import { holderLabel } from "@/lib/allocations";
import { handle, fail, ok } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { notifyMany } from "@/lib/notifications";
import { hasRole, requireAuth } from "@/lib/rbac";

const schema = z.object({
  assetId: z.string().trim().min(1),
  toEmployeeId: z.string().trim().min(1),
  reason: z.string().trim().max(1000).optional(),
});

const transferInclude = {
  asset: { select: { id: true, name: true, assetTag: true } },
  fromEmployee: { select: { id: true, name: true, email: true } },
  toEmployee: { select: { id: true, name: true, email: true } },
  requestedBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true } },
} as const;

export const GET = handle(async () => {
  const session = await requireAuth();
  const canViewAll = hasRole(session, "ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD");
  const transfers = await prisma.transfer.findMany({
    where: canViewAll
      ? {}
      : {
          OR: [
            { requestedById: session.sub },
            { fromEmployeeId: session.sub },
            { toEmployeeId: session.sub },
          ],
        },
    include: transferInclude,
    orderBy: { createdAt: "desc" },
  });

  return ok({ transfers });
});

export const POST = handle(async (req) => {
  const session = await requireAuth();
  const body = schema.parse(await req.json());
  const [active, toEmployee] = await Promise.all([
    prisma.allocation.findFirst({
      where: { assetId: body.assetId, status: "ACTIVE" },
      include: {
        asset: { select: { id: true, name: true, assetTag: true } },
        holder: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    }),
    prisma.employee.findUnique({
      where: { id: body.toEmployeeId },
      select: { id: true, name: true, status: true },
    }),
  ]);

  if (!active) return fail("Asset is not currently allocated. Allocate it directly instead.", 409);
  if (!toEmployee || toEmployee.status !== "ACTIVE") return fail("Select an active target employee", 422);
  if (active.holder?.id === body.toEmployeeId) return fail("Asset is already held by that employee", 422);

  const canRequest =
    active.holder?.id === session.sub || hasRole(session, "ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD");

  if (!canRequest) {
    return fail(`Only the current holder or an approver can request transfer from ${holderLabel(active)}`, 403);
  }

  const existing = await prisma.transfer.findFirst({
    where: { assetId: body.assetId, status: "REQUESTED" },
    select: { id: true },
  });

  if (existing) return fail("A transfer request is already pending for this asset", 409);

  const transfer = await prisma.transfer.create({
    data: {
      assetId: body.assetId,
      fromEmployeeId: active.holder?.id,
      toEmployeeId: body.toEmployeeId,
      requestedById: session.sub,
      reason: body.reason,
    },
    include: transferInclude,
  });

  await logActivity(session.sub, "TRANSFER_REQUESTED", "Transfer", transfer.id, {
    assetId: active.asset.id,
    assetTag: active.asset.assetTag,
    from: holderLabel(active),
    to: toEmployee.name,
  });

  const approvers = await prisma.employee.findMany({
    where: { status: "ACTIVE", role: { in: ["ASSET_MANAGER", "DEPARTMENT_HEAD"] } },
    select: { id: true },
  });

  await notifyMany(
    (approvers as { id: string }[]).map((employee) => employee.id),
    "TRANSFER_REQUESTED",
    `${active.asset.name} (${active.asset.assetTag}) transfer requested to ${toEmployee.name}.`,
    { linkUrl: "/allocations" }
  );

  return ok(transfer, 201);
});
