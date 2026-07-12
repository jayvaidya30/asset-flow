import {
  AssetStatus,
  AuditCycleStatus,
  AuditResult,
  BookingStatus,
  MaintenanceStatus,
  Role,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { canTransition, transitionAsset } from "@/lib/asset-status";
import { prisma } from "@/lib/db";
import { notify, notifyMany } from "@/lib/notifications";
import type { SessionPayload } from "@/lib/auth";

export class Track3Error extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

const dateSchema = z.coerce.date();

export const bookingCreateSchema = z
  .object({
    assetId: z.string().cuid(),
    startTime: dateSchema,
    endTime: dateSchema,
    purpose: z.string().trim().max(500).optional(),
    departmentId: z.string().cuid().optional(),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "The end time must be after the start time.",
    path: ["endTime"],
  });

export const bookingUpdateSchema = z.union([
  z.object({ action: z.literal("cancel") }),
  z
    .object({
      action: z.literal("reschedule"),
      startTime: dateSchema,
      endTime: dateSchema,
      purpose: z.string().trim().max(500).optional(),
    })
    .refine((value) => value.endTime > value.startTime, {
      message: "The end time must be after the start time.",
      path: ["endTime"],
    }),
]);

export const maintenanceCreateSchema = z.object({
  assetId: z.string().cuid(),
  description: z.string().trim().min(10).max(2_000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  photoUrl: z.string().url().optional().or(z.literal("")),
});

export const maintenanceActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("assign"), technicianId: z.string().cuid() }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("resolve"), resolutionNotes: z.string().trim().min(3).max(2_000) }),
]);

export const auditCreateSchema = z
  .object({
    name: z.string().trim().min(3).max(160),
    scopeDepartmentId: z.string().cuid().optional(),
    scopeLocation: z.string().trim().min(1).max(160).optional(),
    startDate: dateSchema,
    endDate: dateSchema,
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "The end date cannot be before the start date.",
    path: ["endDate"],
  });

export const auditorsSchema = z.object({ auditorIds: z.array(z.string().cuid()).min(1).max(100) });
export const auditItemSchema = z.object({
  result: z.enum(["VERIFIED", "MISSING", "DAMAGED"]),
  notes: z.string().trim().max(1_000).optional(),
});

const BOOKABLE_ASSET_STATES: AssetStatus[] = [AssetStatus.AVAILABLE, AssetStatus.RESERVED];
const CANCELLABLE_BOOKING_STATES: BookingStatus[] = [BookingStatus.UPCOMING, BookingStatus.ONGOING];
const UNMAINTAINABLE_ASSET_STATES: AssetStatus[] = [AssetStatus.DISPOSED, AssetStatus.RETIRED, AssetStatus.LOST];
const DISCREPANCY_RESULTS: AuditResult[] = [AuditResult.MISSING, AuditResult.DAMAGED];
const AUDIT_OVERVIEW_ROLES: Role[] = [Role.ADMIN, Role.ASSET_MANAGER];

async function runTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt < 2 && typeof error === "object" && error && "code" in error && error.code === "P2034") continue;
      throw error;
    }
  }
  throw new Error("Transaction retry limit reached.");
}

export async function syncBookingStatuses(now = new Date()) {
  await prisma.booking.updateMany({
    where: { status: BookingStatus.UPCOMING, startTime: { lte: now }, endTime: { gt: now } },
    data: { status: BookingStatus.ONGOING },
  });
  await prisma.booking.updateMany({
    where: {
      status: { in: [BookingStatus.UPCOMING, BookingStatus.ONGOING] },
      endTime: { lte: now },
    },
    data: { status: BookingStatus.COMPLETED },
  });
}

export async function listBookings(assetId?: string) {
  await syncBookingStatuses();
  return prisma.booking.findMany({
    where: assetId ? { assetId } : undefined,
    include: {
      asset: { select: { id: true, assetTag: true, name: true, location: true } },
      bookedBy: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
    orderBy: { startTime: "asc" },
    take: 300,
  });
}

export async function getManagedDepartmentIds(session: SessionPayload) {
  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: session.sub },
    select: { departmentId: true, headedDepartments: { select: { id: true } } },
  });
  return [...new Set([employee.departmentId, ...employee.headedDepartments.map((department) => department.id)].filter(Boolean))] as string[];
}

async function bookingDepartmentId(session: SessionPayload, requestedDepartmentId?: string) {
  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: session.sub },
    select: { departmentId: true },
  });
  if (!requestedDepartmentId) return employee.departmentId;
  if (session.role !== Role.DEPARTMENT_HEAD) {
    if (requestedDepartmentId !== employee.departmentId) throw new Track3Error("You may only book for your own department.", 403);
    return requestedDepartmentId;
  }
  const allowed = await getManagedDepartmentIds(session);
  if (!allowed.includes(requestedDepartmentId)) throw new Track3Error("You may only book for a department you manage.", 403);
  return requestedDepartmentId;
}

export async function assertBookingCanBeManaged(session: SessionPayload, bookingId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { asset: { select: { assetTag: true, name: true } } },
  });
  if (booking.bookedById === session.sub) return booking;
  if (session.role !== Role.DEPARTMENT_HEAD) throw new Track3Error("You can only modify your own bookings.", 403);
  const departmentIds = await getManagedDepartmentIds(session);
  if (!booking.departmentId || !departmentIds.includes(booking.departmentId)) {
    throw new Track3Error("You can only modify bookings for departments you manage.", 403);
  }
  return booking;
}

async function ensureNoBookingOverlap(
  tx: Prisma.TransactionClient,
  assetId: string,
  startTime: Date,
  endTime: Date,
  excludeId?: string
) {
  const conflict = await tx.booking.findFirst({
    where: {
      assetId,
      status: { in: [BookingStatus.UPCOMING, BookingStatus.ONGOING] },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    include: { bookedBy: { select: { name: true } } },
  });
  if (conflict) throw new Track3Error(`This overlaps ${conflict.bookedBy.name}'s existing booking.`, 409);
}

export async function createBooking(session: SessionPayload, input: z.infer<typeof bookingCreateSchema>) {
  await syncBookingStatuses();
  if (input.startTime <= new Date()) throw new Track3Error("Bookings must start in the future.", 422);
  const departmentId = await bookingDepartmentId(session, input.departmentId);
  return runTransaction(async (tx) => {
    const asset = await tx.asset.findUniqueOrThrow({ where: { id: input.assetId } });
    if (!asset.isBookable) throw new Track3Error("Only assets marked bookable can be reserved.", 422);
    if (!BOOKABLE_ASSET_STATES.includes(asset.status)) {
      throw new Track3Error("This resource is not currently available for booking.", 409);
    }
    await ensureNoBookingOverlap(tx, input.assetId, input.startTime, input.endTime);
    const booking = await tx.booking.create({
      data: { ...input, departmentId, bookedById: session.sub, purpose: input.purpose || null },
      include: { asset: { select: { assetTag: true, name: true } } },
    });
    await notify(session.sub, "BOOKING_CONFIRMED", `${asset.name} is booked for your selected time.`, {
      linkUrl: "/bookings",
      tx,
    });
    await logActivity(session.sub, "BOOKING_CREATED", "Booking", booking.id, { assetTag: asset.assetTag }, tx);
    return booking;
  });
}

export async function updateBooking(
  session: SessionPayload,
  bookingId: string,
  input: z.infer<typeof bookingUpdateSchema>
) {
  await syncBookingStatuses();
  const booking = await assertBookingCanBeManaged(session, bookingId);
  if (input.action === "cancel") {
    if (!CANCELLABLE_BOOKING_STATES.includes(booking.status)) {
      throw new Track3Error("Only upcoming or ongoing bookings can be cancelled.", 409);
    }
    return runTransaction(async (tx) => {
      const updated = await tx.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.CANCELLED } });
      await notify(booking.bookedById, "BOOKING_CANCELLED", `${booking.asset.name} booking was cancelled.`, { linkUrl: "/bookings", tx });
      await logActivity(session.sub, "BOOKING_CANCELLED", "Booking", bookingId, { assetTag: booking.asset.assetTag }, tx);
      return updated;
    });
  }
  if (booking.status !== BookingStatus.UPCOMING) throw new Track3Error("Only upcoming bookings can be rescheduled.", 409);
  if (input.startTime <= new Date()) throw new Track3Error("Bookings must start in the future.", 422);
  return runTransaction(async (tx) => {
    await ensureNoBookingOverlap(tx, booking.assetId, input.startTime, input.endTime, bookingId);
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { startTime: input.startTime, endTime: input.endTime, purpose: input.purpose || null },
    });
    await logActivity(session.sub, "BOOKING_RESCHEDULED", "Booking", bookingId, { assetTag: booking.asset.assetTag }, tx);
    return updated;
  });
}

export async function createMaintenanceRequest(session: SessionPayload, input: z.infer<typeof maintenanceCreateSchema>) {
  return runTransaction(async (tx) => {
    const asset = await tx.asset.findUniqueOrThrow({ where: { id: input.assetId } });
    if (UNMAINTAINABLE_ASSET_STATES.includes(asset.status)) {
      throw new Track3Error("A retired, disposed, or lost asset cannot receive a maintenance request.", 422);
    }
    const request = await tx.maintenanceRequest.create({
      data: { ...input, photoUrl: input.photoUrl || null, raisedById: session.sub },
      include: { asset: { select: { assetTag: true, name: true } } },
    });
    await logActivity(session.sub, "MAINTENANCE_RAISED", "MaintenanceRequest", request.id, { assetTag: asset.assetTag }, tx);
    return request;
  });
}

export async function updateMaintenanceRequest(
  session: SessionPayload,
  requestId: string,
  input: z.infer<typeof maintenanceActionSchema>
) {
  return runTransaction(async (tx) => {
    const request = await tx.maintenanceRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { asset: { select: { assetTag: true, name: true, status: true } } },
    });
    const assertStatus = (expected: MaintenanceStatus) => {
      if (request.status !== expected) throw new Track3Error(`This action requires a ${expected.toLowerCase().replaceAll("_", " ")} request.`, 409);
    };
    if (input.action === "approve") {
      assertStatus(MaintenanceStatus.PENDING);
      if (!canTransition(request.asset.status, AssetStatus.UNDER_MAINTENANCE)) {
        throw new Track3Error("The asset cannot enter maintenance from its current lifecycle state.", 409);
      }
      const updated = await tx.maintenanceRequest.update({
        where: { id: requestId },
        data: { status: MaintenanceStatus.APPROVED, approvedById: session.sub },
      });
      await transitionAsset(request.assetId, AssetStatus.UNDER_MAINTENANCE, { actorId: session.sub, reason: "Maintenance approved", tx });
      await notify(request.raisedById, "MAINTENANCE_APPROVED", `${request.asset.name} is now under maintenance.`, { linkUrl: "/maintenance", tx });
      await logActivity(session.sub, "MAINTENANCE_APPROVED", "MaintenanceRequest", requestId, { assetTag: request.asset.assetTag }, tx);
      return updated;
    }
    if (input.action === "reject") {
      assertStatus(MaintenanceStatus.PENDING);
      const updated = await tx.maintenanceRequest.update({ where: { id: requestId }, data: { status: MaintenanceStatus.REJECTED, approvedById: session.sub } });
      await notify(request.raisedById, "MAINTENANCE_REJECTED", `${request.asset.name} maintenance request was rejected.`, { linkUrl: "/maintenance", tx });
      await logActivity(session.sub, "MAINTENANCE_REJECTED", "MaintenanceRequest", requestId, { assetTag: request.asset.assetTag }, tx);
      return updated;
    }
    if (input.action === "assign") {
      assertStatus(MaintenanceStatus.APPROVED);
      const technician = await tx.employee.findFirst({ where: { id: input.technicianId, status: "ACTIVE" }, select: { id: true, name: true } });
      if (!technician) throw new Track3Error("Choose an active technician.", 422);
      const updated = await tx.maintenanceRequest.update({
        where: { id: requestId },
        data: { status: MaintenanceStatus.TECHNICIAN_ASSIGNED, technicianId: technician.id },
      });
      await logActivity(session.sub, "MAINTENANCE_TECHNICIAN_ASSIGNED", "MaintenanceRequest", requestId, { technician: technician.name }, tx);
      return updated;
    }
    if (input.action === "start") {
      assertStatus(MaintenanceStatus.TECHNICIAN_ASSIGNED);
      const updated = await tx.maintenanceRequest.update({ where: { id: requestId }, data: { status: MaintenanceStatus.IN_PROGRESS } });
      await logActivity(session.sub, "MAINTENANCE_STARTED", "MaintenanceRequest", requestId, { assetTag: request.asset.assetTag }, tx);
      return updated;
    }
    assertStatus(MaintenanceStatus.IN_PROGRESS);
    if (!canTransition(request.asset.status, AssetStatus.AVAILABLE)) {
      throw new Track3Error("The asset cannot be returned to available from its current lifecycle state.", 409);
    }
    const updated = await tx.maintenanceRequest.update({
      where: { id: requestId },
      data: { status: MaintenanceStatus.RESOLVED, resolutionNotes: input.resolutionNotes, resolvedAt: new Date() },
    });
    await transitionAsset(request.assetId, AssetStatus.AVAILABLE, { actorId: session.sub, reason: "Maintenance resolved", tx });
    await logActivity(session.sub, "MAINTENANCE_RESOLVED", "MaintenanceRequest", requestId, { assetTag: request.asset.assetTag }, tx);
    return updated;
  });
}

function auditAssetWhere(input: z.infer<typeof auditCreateSchema>): Prisma.AssetWhereInput {
  return {
    ...(input.scopeLocation ? { location: input.scopeLocation } : {}),
    ...(input.scopeDepartmentId
      ? {
          allocations: {
            some: {
              status: "ACTIVE",
              OR: [
                { departmentId: input.scopeDepartmentId },
                { holder: { departmentId: input.scopeDepartmentId } },
              ],
            },
          },
        }
      : {}),
  };
}

export async function createAuditCycle(session: SessionPayload, input: z.infer<typeof auditCreateSchema>) {
  const assets = await prisma.asset.findMany({ where: auditAssetWhere(input), select: { id: true } });
  if (!assets.length) throw new Track3Error("No assets match this audit scope.", 422);
  return runTransaction(async (tx) => {
    const cycle = await tx.auditCycle.create({
      data: {
        ...input,
        scopeDepartmentId: input.scopeDepartmentId || null,
        scopeLocation: input.scopeLocation || null,
        createdById: session.sub,
        items: { createMany: { data: assets.map((asset) => ({ assetId: asset.id })) } },
      },
      include: { _count: { select: { items: true } } },
    });
    await logActivity(session.sub, "AUDIT_CYCLE_CREATED", "AuditCycle", cycle.id, { itemCount: assets.length }, tx);
    return cycle;
  });
}

export async function assignAuditors(session: SessionPayload, cycleId: string, auditorIds: string[]) {
  return prisma.$transaction(async (tx) => {
    const cycle = await tx.auditCycle.findUniqueOrThrow({ where: { id: cycleId } });
    if (cycle.status !== AuditCycleStatus.OPEN) throw new Track3Error("Closed audit cycles cannot be changed.", 409);
    const auditors = await tx.employee.findMany({ where: { id: { in: auditorIds }, status: "ACTIVE" }, select: { id: true } });
    if (auditors.length !== new Set(auditorIds).size) throw new Track3Error("Every assigned auditor must be an active employee.", 422);
    await tx.auditAssignment.createMany({ data: auditors.map((auditor) => ({ cycleId, auditorId: auditor.id })), skipDuplicates: true });
    await notifyMany(auditors.map((auditor) => auditor.id), "AUDIT_DISCREPANCY", `You have been assigned to audit cycle “${cycle.name}”.`, { title: "Audit assignment", linkUrl: `/audits?cycle=${cycleId}`, tx });
    await logActivity(session.sub, "AUDITORS_ASSIGNED", "AuditCycle", cycleId, { auditorCount: auditors.length }, tx);
    return { assigned: auditors.length };
  });
}

export async function updateAuditItem(
  session: SessionPayload,
  cycleId: string,
  assetId: string,
  input: z.infer<typeof auditItemSchema>
) {
  return prisma.$transaction(async (tx) => {
    const [cycle, assignment, item] = await Promise.all([
      tx.auditCycle.findUniqueOrThrow({ where: { id: cycleId } }),
      tx.auditAssignment.findUnique({ where: { cycleId_auditorId: { cycleId, auditorId: session.sub } } }),
      tx.auditItem.findUniqueOrThrow({ where: { cycleId_assetId: { cycleId, assetId } }, include: { asset: { select: { assetTag: true, name: true } } } }),
    ]);
    if (cycle.status !== AuditCycleStatus.OPEN) throw new Track3Error("Closed audit cycles are immutable.", 409);
    if (!assignment) throw new Track3Error("Only an assigned auditor may record results.", 403);
    const updated = await tx.auditItem.update({
      where: { id: item.id },
      data: { result: input.result as AuditResult, notes: input.notes || null, auditorId: session.sub, checkedAt: new Date() },
    });
    if (DISCREPANCY_RESULTS.includes(input.result as AuditResult) && !DISCREPANCY_RESULTS.includes(item.result)) {
      const recipients = await tx.employee.findMany({ where: { role: { in: [Role.ADMIN, Role.ASSET_MANAGER] }, status: "ACTIVE" }, select: { id: true } });
      await notifyMany(recipients.map((recipient) => recipient.id), "AUDIT_DISCREPANCY", `${item.asset.name} (${item.asset.assetTag}) was marked ${input.result.toLowerCase()}.`, { linkUrl: `/audits?cycle=${cycleId}`, tx });
    }
    await logActivity(session.sub, "AUDIT_ITEM_CHECKED", "AuditItem", item.id, { result: input.result, assetTag: item.asset.assetTag }, tx);
    return updated;
  });
}

export async function closeAuditCycle(session: SessionPayload, cycleId: string) {
  return prisma.$transaction(async (tx) => {
    const cycle = await tx.auditCycle.findUniqueOrThrow({
      where: { id: cycleId },
      include: { items: { include: { asset: { select: { id: true, assetTag: true, status: true } } } } },
    });
    if (cycle.status !== AuditCycleStatus.OPEN) throw new Track3Error("This audit cycle is already closed.", 409);
    const pending = cycle.items.filter((item) => item.result === AuditResult.PENDING);
    if (pending.length) throw new Track3Error(`${pending.length} audit item(s) still need a result before closing.`, 409);
    for (const item of cycle.items.filter((candidate) => candidate.result === AuditResult.MISSING)) {
      if (!canTransition(item.asset.status, AssetStatus.LOST)) {
        throw new Track3Error(`${item.asset.assetTag} cannot be marked lost from its current status.`, 409);
      }
      await transitionAsset(item.assetId, AssetStatus.LOST, { actorId: session.sub, reason: `Audit cycle ${cycle.name}`, tx });
    }
    const closed = await tx.auditCycle.update({ where: { id: cycleId }, data: { status: AuditCycleStatus.CLOSED, closedAt: new Date() } });
    const discrepancies = cycle.items.filter((item) => DISCREPANCY_RESULTS.includes(item.result)).length;
    await logActivity(session.sub, "AUDIT_CLOSED", "AuditCycle", cycleId, { discrepancies }, tx);
    return closed;
  });
}

export async function listMaintenanceRequests(session: SessionPayload) {
  let where: Prisma.MaintenanceRequestWhereInput = {};
  if (!AUDIT_OVERVIEW_ROLES.includes(session.role)) {
    if (session.role === Role.DEPARTMENT_HEAD) {
      const departmentIds = await getManagedDepartmentIds(session);
      where = { OR: [{ raisedById: session.sub }, { raisedBy: { departmentId: { in: departmentIds } } }] };
    } else {
      where = { raisedById: session.sub };
    }
  }
  return prisma.maintenanceRequest.findMany({
    where,
    include: {
      asset: { select: { id: true, assetTag: true, name: true } },
      raisedBy: { select: { id: true, name: true } },
      technician: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function listAuditCycles(session: SessionPayload) {
  const where: Prisma.AuditCycleWhereInput = AUDIT_OVERVIEW_ROLES.includes(session.role)
    ? {}
    : { assignments: { some: { auditorId: session.sub } } };
  return prisma.auditCycle.findMany({
    where,
    include: {
      scopeDepartment: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { items: true, assignments: true } },
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    take: 100,
  });
}

export async function getAuditCycleForViewer(session: SessionPayload, cycleId: string) {
  const cycle = await prisma.auditCycle.findUniqueOrThrow({
    where: { id: cycleId },
    include: {
      scopeDepartment: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      assignments: {
        include: { auditor: { select: { id: true, name: true, email: true } } },
        orderBy: { auditor: { name: "asc" } },
      },
      items: {
        include: {
          asset: { select: { id: true, assetTag: true, name: true, location: true, status: true } },
          auditor: { select: { id: true, name: true } },
        },
        orderBy: [{ result: "asc" }, { asset: { assetTag: "asc" } }],
      },
      _count: { select: { items: true, assignments: true } },
    },
  });
  if (
    !AUDIT_OVERVIEW_ROLES.includes(session.role) &&
    !cycle.assignments.some((assignment) => assignment.auditorId === session.sub)
  ) {
    throw new Track3Error("You are not assigned to this audit cycle.", 403);
  }
  return cycle;
}
