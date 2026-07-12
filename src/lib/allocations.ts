import { prisma } from "@/lib/db";

export type HolderInput = {
  holderId?: string;
  departmentId?: string;
};

export const allocationListInclude = {
  asset: {
    select: {
      id: true,
      assetTag: true,
      name: true,
      status: true,
      location: true,
      category: { select: { name: true } },
    },
  },
  holder: { select: { id: true, name: true, email: true, departmentId: true } },
  department: { select: { id: true, name: true } },
  allocatedBy: { select: { id: true, name: true } },
} as const;

export const activeAllocationInclude = {
  holder: { select: { id: true, name: true, email: true } },
  department: { select: { id: true, name: true } },
} as const;

export function holderLabel(holder: {
  holder?: { name: string } | null;
  department?: { name: string } | null;
}) {
  if (holder.holder) return holder.holder.name;
  if (holder.department) return holder.department.name;

  return "Unknown holder";
}

export function isOverdue(expectedReturnDate: Date | null | undefined, now = new Date()) {
  return !!expectedReturnDate && expectedReturnDate.getTime() < now.getTime();
}

export async function listActiveAllocations() {
  return prisma.allocation.findMany({
    where: { status: "ACTIVE" },
    include: allocationListInclude,
    orderBy: [{ expectedReturnDate: "asc" }, { allocatedAt: "desc" }],
  });
}

export async function findActiveAllocation(assetId: string) {
  return prisma.allocation.findFirst({
    where: { assetId, status: "ACTIVE" },
    include: activeAllocationInclude,
  });
}
