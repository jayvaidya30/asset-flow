import { z } from "zod";
import { transitionAsset } from "@/lib/asset-status";
import { findActiveAllocation, holderLabel, listActiveAllocations, countActiveAllocations } from "@/lib/allocations";
import { handle, fail, ok } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { requireRole } from "@/lib/rbac";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date")
    .transform((value) => new Date(value))
    .optional()
);

const schema = z
  .object({
    assetId: z.string().trim().min(1),
    holderId: z.string().trim().optional(),
    departmentId: z.string().trim().optional(),
    expectedReturnDate: optionalDate,
  })
  .refine((data) => Boolean(data.holderId) !== Boolean(data.departmentId), {
    message: "Choose either an employee or a department holder",
    path: ["holderId"],
  });

export const GET = handle(async (req) => {
  await requireRole("ASSET_MANAGER", "DEPARTMENT_HEAD");

  const url = new URL(req.url);
  const { page, pageSize } = paginationSchema.parse(
    Object.fromEntries(url.searchParams)
  );
  const skip = (page - 1) * pageSize;

  const [allocations, total] = await Promise.all([
    listActiveAllocations({ skip, take: pageSize }),
    countActiveAllocations(),
  ]);

  return ok({
    allocations,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

export const POST = handle(async (req) => {
  const session = await requireRole("ASSET_MANAGER", "DEPARTMENT_HEAD");
  const body = schema.parse(await req.json());

  const [asset, holder, department, active] = await Promise.all([
    prisma.asset.findUnique({
      where: { id: body.assetId },
      select: { id: true, name: true, assetTag: true, status: true },
    }),
    body.holderId
      ? prisma.employee.findUnique({
          where: { id: body.holderId },
          select: { id: true, name: true, status: true },
        })
      : null,
    body.departmentId
      ? prisma.department.findUnique({
          where: { id: body.departmentId },
          select: { id: true, name: true, status: true },
        })
      : null,
    findActiveAllocation(body.assetId),
  ]);

  if (!asset) return fail("Asset not found", 404);
  if (body.holderId && (!holder || holder.status !== "ACTIVE")) {
    return fail("Select an active employee holder", 422);
  }
  if (body.departmentId && (!department || department.status !== "ACTIVE")) {
    return fail("Select an active department holder", 422);
  }
  if (active) {
    const currentHolder = holderLabel(active);

    return fail(`Asset currently held by ${currentHolder}`, 409, {
      holderId: active.holder?.id,
      departmentId: active.department?.id,
    });
  }
  if (asset.status !== "AVAILABLE" && asset.status !== "RESERVED") {
    return fail(`Asset is ${asset.status.replaceAll("_", " ").toLowerCase()} and cannot be allocated`, 409);
  }

  const allocation = await prisma.$transaction(async (tx: any) => {
    const created = await tx.allocation.create({
      data: {
        assetId: body.assetId,
        holderId: body.holderId,
        departmentId: body.departmentId,
        allocatedById: session.sub,
        expectedReturnDate: body.expectedReturnDate,
      },
      include: {
        holder: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
        asset: { select: { id: true, name: true, assetTag: true } },
      },
    });

    await transitionAsset(body.assetId, "ALLOCATED" as any, {
      actorId: session.sub,
      reason: "allocation",
      tx,
      currentStatus: asset.status,
    });

    return created;
  });

  await logActivity(session.sub, "ASSET_ALLOCATED", "Allocation", allocation.id, {
    assetId: asset.id,
    assetTag: asset.assetTag,
    holder: holder ? holder.name : department?.name,
    expectedReturnDate: body.expectedReturnDate?.toISOString(),
  });

  if (allocation.holder?.id) {
    await notify(
      allocation.holder.id,
      "ASSET_ASSIGNED",
      `${allocation.asset.name} (${allocation.asset.assetTag}) has been assigned to you.`,
      { linkUrl: "/allocations" }
    );
  }

  return ok(allocation, 201);
});
