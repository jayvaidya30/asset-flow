import { z } from "zod";
import { transitionAsset } from "@/lib/asset-status";
import { handle, fail, ok } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

const schema = z.object({
  checkInCondition: z.string().trim().max(120).optional(),
  checkInNotes: z.string().trim().max(1000).optional(),
});

export const POST = handle(async (req, ctx) => {
  const session = await requireRole("ASSET_MANAGER");
  const { id } = await ctx.params;
  const body = schema.parse(await req.json());

  const existing = await prisma.allocation.findFirst({
    where: { id, status: "ACTIVE" },
    include: {
      asset: { select: { id: true, name: true, assetTag: true, status: true } },
      holder: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });

  if (!existing) return fail("Active allocation not found", 404);

  const allocation = await prisma.$transaction(async (tx: any) => {
    const updated = await tx.allocation.update({
      where: { id },
      data: {
        status: "RETURNED",
        returnedAt: new Date(),
        checkInCondition: body.checkInCondition,
        checkInNotes: body.checkInNotes,
      },
      include: {
        asset: { select: { id: true, name: true, assetTag: true, status: true } },
        holder: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    await transitionAsset(existing.asset.id, "AVAILABLE" as any, {
      actorId: session.sub,
      reason: "return",
      tx,
      currentStatus: existing.asset.status,
    });

    return updated;
  });

  await logActivity(session.sub, "ASSET_RETURNED", "Allocation", allocation.id, {
    assetId: existing.asset.id,
    assetTag: existing.asset.assetTag,
    checkInCondition: body.checkInCondition,
  });

  return ok(allocation);
});
