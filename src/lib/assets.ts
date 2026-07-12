import { prisma } from "@/lib/db";
import { formatAssetTag } from "@/lib/utils";

export const ASSET_STATUSES = [
  "AVAILABLE",
  "ALLOCATED",
  "RESERVED",
  "UNDER_MAINTENANCE",
  "LOST",
  "RETIRED",
  "DISPOSED",
] as const;

export type AssetStatusValue = (typeof ASSET_STATUSES)[number];

export type AssetFilters = {
  tag?: string;
  serial?: string;
  category?: string;
  status?: AssetStatusValue;
  dept?: string;
  location?: string;
};

type SearchSource = URLSearchParams | Record<string, string | string[] | undefined>;
type AssetTagClient = {
  asset: {
    findFirst(args: unknown): Promise<{ assetTag: string } | null>;
  };
};

export const assetListInclude = {
  category: true,
  allocations: {
    where: { status: "ACTIVE" },
    orderBy: { allocatedAt: "desc" },
    take: 1,
    include: {
      holder: { select: { id: true, name: true, departmentId: true } },
      department: { select: { id: true, name: true } },
    },
  },
} as const;

export function parseAssetFilters(source: SearchSource): AssetFilters {
  const read = (key: string) => {
    const value =
      source instanceof URLSearchParams
        ? source.get(key)
        : Array.isArray(source[key])
          ? source[key]?.[0]
          : source[key];

    return value?.trim() || undefined;
  };

  const status = read("status");

  return {
    tag: read("tag"),
    serial: read("serial"),
    category: read("category"),
    status: ASSET_STATUSES.includes(status as AssetStatusValue) ? (status as AssetStatusValue) : undefined,
    dept: read("dept"),
    location: read("location"),
  };
}

export function buildAssetWhere(filters: AssetFilters) {
  const clauses: Record<string, unknown>[] = [];

  if (filters.tag) clauses.push({ assetTag: { contains: filters.tag, mode: "insensitive" } });
  if (filters.serial) clauses.push({ serialNumber: { contains: filters.serial, mode: "insensitive" } });
  if (filters.category) clauses.push({ categoryId: filters.category });
  if (filters.status) clauses.push({ status: filters.status });
  if (filters.location) clauses.push({ location: { contains: filters.location, mode: "insensitive" } });
  if (filters.dept) {
    clauses.push({
      allocations: {
        some: {
          status: "ACTIVE",
          OR: [{ departmentId: filters.dept }, { holder: { departmentId: filters.dept } }],
        },
      },
    });
  }

  return clauses.length ? { AND: clauses } : {};
}

export async function listAssets(
  filters: AssetFilters,
  opts?: { skip?: number; take?: number }
) {
  const where = buildAssetWhere(filters);
  return prisma.asset.findMany({
    where,
    include: assetListInclude,
    orderBy: [{ createdAt: "desc" }, { assetTag: "desc" }],
    skip: opts?.skip,
    take: opts?.take,
  });
}

export async function countAssets(filters: AssetFilters) {
  return prisma.asset.count({ where: buildAssetWhere(filters) });
}

export async function nextAssetTag(tx: AssetTagClient) {
  const latest = await tx.asset.findFirst({
    where: { assetTag: { startsWith: "AF-" } },
    orderBy: { assetTag: "desc" },
    select: { assetTag: true },
  });
  const latestNumber = latest ? Number.parseInt(latest.assetTag.slice(3), 10) : 0;

  return formatAssetTag(Number.isFinite(latestNumber) ? latestNumber + 1 : 1);
}
