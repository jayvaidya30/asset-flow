import { prisma } from "@/lib/db";
import { handle, fail, ok } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";

export const GET = handle(async (_req, ctx) => {
  await requireAuth();

  const { id } = await ctx.params;
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      category: true,
      allocations: {
        orderBy: { allocatedAt: "desc" },
        take: 20,
        include: {
          holder: { select: { id: true, name: true, email: true } },
          department: { select: { id: true, name: true } },
          allocatedBy: { select: { id: true, name: true } },
        },
      },
      maintenanceRequests: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          raisedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          technician: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!asset) return fail("Asset not found", 404);

  return ok(asset);
});
