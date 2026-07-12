import {
  AllocationStatus,
  AssetStatus,
  BookingStatus,
  MaintenanceStatus,
  TransferStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "./db";
import type { SessionPayload } from "./auth";

export type InsightScope = {
  session: SessionPayload;
  orgWide: boolean;
  departmentIds: string[];
  employeeIds: string[];
};

export type ReportType =
  | "allocation-summary"
  | "maintenance-frequency"
  | "asset-utilization"
  | "booking-heatmap"
  | "overdue-returns";

export type ReportResult = {
  title: string;
  description: string;
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, string | number>[];
};

type ReportFilters = {
  departmentId?: string;
  categoryId?: string;
  from?: Date;
  to?: Date;
};

const UPCOMING_RETURN_DAYS = 14;

export async function getInsightScope(session: SessionPayload): Promise<InsightScope> {
  if (session.role === "ADMIN" || session.role === "ASSET_MANAGER") {
    return { session, orgWide: true, departmentIds: [], employeeIds: [] };
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.sub },
    select: { departmentId: true },
  });

  if (session.role === "DEPARTMENT_HEAD") {
    const departmentOr: Prisma.DepartmentWhereInput[] = [{ headId: session.sub }];
    if (employee?.departmentId) departmentOr.push({ id: employee.departmentId });

    const departments = await prisma.department.findMany({
      where: { OR: departmentOr },
      select: { id: true },
    });
    const departmentIds = unique(departments.map((department) => department.id));
    const members = departmentIds.length
      ? await prisma.employee.findMany({
          where: { departmentId: { in: departmentIds } },
          select: { id: true },
        })
      : [];

    return {
      session,
      orgWide: false,
      departmentIds,
      employeeIds: unique([session.sub, ...members.map((member) => member.id)]),
    };
  }

  return {
    session,
    orgWide: false,
    departmentIds: [],
    employeeIds: [session.sub],
  };
}

export async function getDashboardKpis(session: SessionPayload) {
  const scope = await getInsightScope(session);
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const upcomingUntil = addDays(now, UPCOMING_RETURN_DAYS);

  const assetWhere = assetWhereForScope(scope);
  const allocationWhere = allocationWhereForScope(scope);
  const bookingWhere = bookingWhereForScope(scope);
  const maintenanceWhere = maintenanceWhereForScope(scope);
  const transferWhere = transferWhereForScope(scope);

  const [
    assetsAvailable,
    assetsAllocated,
    maintenanceToday,
    activeBookings,
    pendingTransfers,
    upcomingReturns,
    overdueReturns,
    unreadNotifications,
    recentActivity,
  ] = await Promise.all([
    prisma.asset.count({ where: { ...assetWhere, status: AssetStatus.AVAILABLE } }),
    prisma.asset.count({ where: { ...assetWhere, status: AssetStatus.ALLOCATED } }),
    prisma.maintenanceRequest.count({
      where: {
        ...maintenanceWhere,
        createdAt: { gte: todayStart, lte: todayEnd },
        status: { notIn: [MaintenanceStatus.RESOLVED, MaintenanceStatus.REJECTED] },
      },
    }),
    prisma.booking.count({
      where: {
        ...bookingWhere,
        status: { notIn: [BookingStatus.CANCELLED, BookingStatus.COMPLETED] },
        startTime: { lte: now },
        endTime: { gte: now },
      },
    }),
    prisma.transfer.count({
      where: { ...transferWhere, status: TransferStatus.REQUESTED },
    }),
    prisma.allocation.count({
      where: {
        ...allocationWhere,
        status: AllocationStatus.ACTIVE,
        expectedReturnDate: { gte: now, lte: upcomingUntil },
      },
    }),
    prisma.allocation.count({
      where: {
        ...allocationWhere,
        status: AllocationStatus.ACTIVE,
        expectedReturnDate: { lt: now },
      },
    }),
    prisma.notification.count({ where: { userId: session.sub, isRead: false } }),
    getActivity(session, 6),
  ]);

  return {
    scopeLabel: scopeLabel(scope),
    kpis: [
      { key: "assetsAvailable", label: "Assets Available", value: assetsAvailable },
      { key: "assetsAllocated", label: "Assets Allocated", value: assetsAllocated },
      { key: "maintenanceToday", label: "Maintenance Today", value: maintenanceToday },
      { key: "activeBookings", label: "Active Bookings", value: activeBookings },
      { key: "pendingTransfers", label: "Pending Transfers", value: pendingTransfers },
      { key: "upcomingReturns", label: "Upcoming Returns", value: upcomingReturns },
    ],
    overdueReturns,
    unreadNotifications,
    recentActivity,
  };
}

export async function getNotifications(session: SessionPayload, limit = 50) {
  return prisma.notification.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markNotificationRead(session: SessionPayload, id: string) {
  return prisma.notification.updateMany({
    where: { id, userId: session.sub },
    data: { isRead: true },
  });
}

export async function markAllNotificationsRead(session: SessionPayload) {
  return prisma.notification.updateMany({
    where: { userId: session.sub, isRead: false },
    data: { isRead: true },
  });
}

export async function getActivity(session: SessionPayload, limit = 50) {
  const scope = await getInsightScope(session);
  return prisma.activityLog.findMany({
    where: activityWhereForScope(scope),
    include: {
      actor: { select: { name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getReport(
  session: SessionPayload,
  type: ReportType,
  filters: ReportFilters = {}
): Promise<ReportResult> {
  const scope = await getInsightScope(session);

  switch (type) {
    case "allocation-summary":
      return allocationSummaryReport(scope, filters);
    case "maintenance-frequency":
      return maintenanceFrequencyReport(scope, filters);
    case "asset-utilization":
      return assetUtilizationReport(scope, filters);
    case "booking-heatmap":
      return bookingHeatmapReport(scope, filters);
    case "overdue-returns":
      return overdueReturnsReport(scope, filters);
  }
}

export function parseReportType(value: string): ReportType | null {
  const allowed: ReportType[] = [
    "allocation-summary",
    "maintenance-frequency",
    "asset-utilization",
    "booking-heatmap",
    "overdue-returns",
  ];
  return allowed.includes(value as ReportType) ? (value as ReportType) : null;
}

export function parseReportFilters(searchParams: URLSearchParams): ReportFilters {
  return {
    departmentId: emptyToUndefined(searchParams.get("departmentId")),
    categoryId: emptyToUndefined(searchParams.get("categoryId")),
    from: parseDateParam(searchParams.get("from")),
    to: parseDateParam(searchParams.get("to"), true),
  };
}

export function reportToCsv(report: ReportResult): string {
  const header = report.columns.map((column) => csvCell(column.label)).join(",");
  const rows = report.rows.map((row) =>
    report.columns.map((column) => csvCell(row[column.key] ?? "")).join(",")
  );
  return [header, ...rows].join("\n");
}

export async function getReportFilterOptions(session: SessionPayload) {
  const scope = await getInsightScope(session);
  const [departments, categories] = await Promise.all([
    prisma.department.findMany({
      where: scope.orgWide ? {} : { id: { in: scope.departmentIds } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.assetCategory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { departments, categories };
}

async function allocationSummaryReport(
  scope: InsightScope,
  filters: ReportFilters
): Promise<ReportResult> {
  const allocations = await prisma.allocation.findMany({
    where: {
      ...allocationWhereForScope(scope),
      ...dateRangeWhere("allocatedAt", filters),
      status: AllocationStatus.ACTIVE,
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      asset: filters.categoryId ? { categoryId: filters.categoryId } : undefined,
    },
    include: {
      department: { select: { name: true } },
      holder: { select: { name: true, department: { select: { name: true } } } },
    },
  });

  const now = new Date();
  const grouped = new Map<string, { allocated: number; overdue: number }>();

  for (const allocation of allocations) {
    const label =
      allocation.department?.name ?? allocation.holder?.department?.name ?? "Unassigned department";
    const row = grouped.get(label) ?? { allocated: 0, overdue: 0 };
    row.allocated += 1;
    if (allocation.expectedReturnDate && allocation.expectedReturnDate < now) row.overdue += 1;
    grouped.set(label, row);
  }

  return {
    title: "Department Allocation Summary",
    description: "Active assignments grouped by owning department or holder department.",
    columns: [
      { key: "department", label: "Department" },
      { key: "allocated", label: "Active allocations", align: "right" },
      { key: "overdue", label: "Overdue", align: "right" },
    ],
    rows: [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([department, row]) => ({ department, ...row })),
  };
}

async function maintenanceFrequencyReport(
  scope: InsightScope,
  filters: ReportFilters
): Promise<ReportResult> {
  const requests = await prisma.maintenanceRequest.findMany({
    where: {
      ...maintenanceWhereForScope(scope),
      ...dateRangeWhere("createdAt", filters),
      asset: filters.categoryId ? { categoryId: filters.categoryId } : undefined,
    },
    include: {
      asset: { select: { assetTag: true, name: true, category: { select: { name: true } } } },
    },
  });

  const grouped = new Map<string, { asset: string; category: string; total: number; open: number }>();
  for (const request of requests) {
    const key = request.assetId;
    const row = grouped.get(key) ?? {
      asset: `${request.asset.assetTag} - ${request.asset.name}`,
      category: request.asset.category.name,
      total: 0,
      open: 0,
    };
    row.total += 1;
    if (request.status !== MaintenanceStatus.RESOLVED && request.status !== MaintenanceStatus.REJECTED) {
      row.open += 1;
    }
    grouped.set(key, row);
  }

  return {
    title: "Maintenance Frequency",
    description: "Maintenance volume by asset and category.",
    columns: [
      { key: "asset", label: "Asset" },
      { key: "category", label: "Category" },
      { key: "total", label: "Requests", align: "right" },
      { key: "open", label: "Open", align: "right" },
    ],
    rows: [...grouped.values()].sort((a, b) => b.total - a.total),
  };
}

async function assetUtilizationReport(
  scope: InsightScope,
  filters: ReportFilters
): Promise<ReportResult> {
  const assets = await prisma.asset.findMany({
    where: {
      ...assetWhereForScope(scope),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    },
    include: {
      category: { select: { name: true } },
      allocations: {
        where: dateRangeWhere("allocatedAt", filters),
        select: { id: true },
      },
      bookings: {
        where: dateRangeWhere("startTime", filters),
        select: { startTime: true, endTime: true },
      },
    },
    orderBy: { assetTag: "asc" },
  });

  return {
    title: "Asset Utilization",
    description: "Allocation events and booked hours by asset.",
    columns: [
      { key: "asset", label: "Asset" },
      { key: "category", label: "Category" },
      { key: "status", label: "Status" },
      { key: "allocations", label: "Allocations", align: "right" },
      { key: "bookings", label: "Bookings", align: "right" },
      { key: "bookedHours", label: "Booked hours", align: "right" },
    ],
    rows: assets.map((asset) => ({
      asset: `${asset.assetTag} - ${asset.name}`,
      category: asset.category.name,
      status: asset.status,
      allocations: asset.allocations.length,
      bookings: asset.bookings.length,
      bookedHours: roundOne(
        asset.bookings.reduce(
          (sum, booking) => sum + (booking.endTime.getTime() - booking.startTime.getTime()) / 3600000,
          0
        )
      ),
    })),
  };
}

async function bookingHeatmapReport(
  scope: InsightScope,
  filters: ReportFilters
): Promise<ReportResult> {
  const bookings = await prisma.booking.findMany({
    where: {
      ...bookingWhereForScope(scope),
      ...dateRangeWhere("startTime", filters),
      status: { not: BookingStatus.CANCELLED },
      asset: filters.categoryId ? { categoryId: filters.categoryId } : undefined,
    },
    select: { startTime: true, endTime: true },
  });

  const grouped = new Map<string, { slot: string; bookings: number; hours: number }>();
  for (const booking of bookings) {
    const label = `${weekday(booking.startTime)} ${String(booking.startTime.getHours()).padStart(2, "0")}:00`;
    const row = grouped.get(label) ?? { slot: label, bookings: 0, hours: 0 };
    row.bookings += 1;
    row.hours += (booking.endTime.getTime() - booking.startTime.getTime()) / 3600000;
    grouped.set(label, row);
  }

  return {
    title: "Booking Heatmap",
    description: "Booking demand grouped by weekday and start hour.",
    columns: [
      { key: "slot", label: "Slot" },
      { key: "bookings", label: "Bookings", align: "right" },
      { key: "hours", label: "Booked hours", align: "right" },
    ],
    rows: [...grouped.values()]
      .map((row) => ({ ...row, hours: roundOne(row.hours) }))
      .sort((a, b) => b.bookings - a.bookings || String(a.slot).localeCompare(String(b.slot))),
  };
}

async function overdueReturnsReport(
  scope: InsightScope,
  filters: ReportFilters
): Promise<ReportResult> {
  const now = new Date();
  const allocations = await prisma.allocation.findMany({
    where: {
      ...allocationWhereForScope(scope),
      status: AllocationStatus.ACTIVE,
      expectedReturnDate: { lt: now },
      asset: filters.categoryId ? { categoryId: filters.categoryId } : undefined,
    },
    include: {
      asset: { select: { assetTag: true, name: true } },
      holder: { select: { name: true } },
      department: { select: { name: true } },
    },
    orderBy: { expectedReturnDate: "asc" },
  });

  return {
    title: "Overdue Returns",
    description: "Active allocations past their expected return date.",
    columns: [
      { key: "asset", label: "Asset" },
      { key: "holder", label: "Holder" },
      { key: "expectedReturnDate", label: "Expected return" },
      { key: "daysOverdue", label: "Days overdue", align: "right" },
    ],
    rows: allocations.map((allocation) => ({
      asset: `${allocation.asset.assetTag} - ${allocation.asset.name}`,
      holder: allocation.holder?.name ?? allocation.department?.name ?? "Unassigned",
      expectedReturnDate: formatDate(allocation.expectedReturnDate),
      daysOverdue: allocation.expectedReturnDate
        ? Math.max(0, Math.floor((now.getTime() - allocation.expectedReturnDate.getTime()) / 86400000))
        : 0,
    })),
  };
}

function assetWhereForScope(scope: InsightScope): Prisma.AssetWhereInput {
  if (scope.orgWide) return {};
  return {
    OR: [
      { allocations: { some: allocationScopeRelation(scope) } },
      { bookings: { some: bookingScopeRelation(scope) } },
      { maintenanceRequests: { some: maintenanceScopeRelation(scope) } },
    ],
  };
}

function allocationWhereForScope(scope: InsightScope): Prisma.AllocationWhereInput {
  if (scope.orgWide) return {};
  return allocationScopeRelation(scope);
}

function transferWhereForScope(scope: InsightScope): Prisma.TransferWhereInput {
  if (scope.orgWide) return {};
  return {
    OR: [
      { fromEmployeeId: { in: scope.employeeIds } },
      { toEmployeeId: { in: scope.employeeIds } },
      { requestedById: { in: scope.employeeIds } },
    ],
  };
}

function bookingWhereForScope(scope: InsightScope): Prisma.BookingWhereInput {
  if (scope.orgWide) return {};
  return bookingScopeRelation(scope);
}

function maintenanceWhereForScope(scope: InsightScope): Prisma.MaintenanceRequestWhereInput {
  if (scope.orgWide) return {};
  return maintenanceScopeRelation(scope);
}

function activityWhereForScope(scope: InsightScope): Prisma.ActivityLogWhereInput {
  if (scope.orgWide) return {};
  return { actorId: { in: scope.employeeIds } };
}

function allocationScopeRelation(scope: InsightScope): Prisma.AllocationWhereInput {
  return {
    OR: [
      { holderId: { in: scope.employeeIds } },
      ...(scope.departmentIds.length ? [{ departmentId: { in: scope.departmentIds } }] : []),
    ],
  };
}

function bookingScopeRelation(scope: InsightScope): Prisma.BookingWhereInput {
  return {
    OR: [
      { bookedById: { in: scope.employeeIds } },
      ...(scope.departmentIds.length ? [{ departmentId: { in: scope.departmentIds } }] : []),
    ],
  };
}

function maintenanceScopeRelation(scope: InsightScope): Prisma.MaintenanceRequestWhereInput {
  return {
    OR: [
      { raisedById: { in: scope.employeeIds } },
      { approvedById: { in: scope.employeeIds } },
      { technicianId: { in: scope.employeeIds } },
    ],
  };
}

function dateRangeWhere(field: "allocatedAt" | "createdAt" | "startTime", filters: ReportFilters) {
  if (!filters.from && !filters.to) return {};
  return {
    [field]: {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    },
  };
}

function parseDateParam(value: string | null, end = false) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return end ? endOfDay(date) : startOfDay(date);
}

function emptyToUndefined(value: string | null) {
  return value && value.trim() ? value : undefined;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function scopeLabel(scope: InsightScope) {
  if (scope.orgWide) return "Organization-wide";
  if (scope.session.role === "DEPARTMENT_HEAD") return "Department scope";
  return "Your activity";
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function weekday(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatDate(date: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
