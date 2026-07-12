import { AssetRegistrationForm } from "./asset-registration-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ASSET_STATUSES, listAssets, parseAssetFilters } from "@/lib/assets";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { getSession } from "@/lib/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type AssetRow = {
  id: string;
  name: string;
  assetTag: string;
  serialNumber: string | null;
  acquisitionDate: Date | null;
  acquisitionCost: unknown;
  status: string;
  isBookable: boolean;
  location: string | null;
  category: { name: string };
  allocations: {
    holder: { name: string } | null;
    department: { name: string } | null;
  }[];
};
type NamedOption = { id: string; name: string };

const statusStyles: Record<string, string> = {
  AVAILABLE: "bg-green-50 text-green-700 ring-green-200",
  ALLOCATED: "bg-blue-50 text-blue-700 ring-blue-200",
  RESERVED: "bg-amber-50 text-amber-700 ring-amber-200",
  UNDER_MAINTENANCE: "bg-orange-50 text-orange-700 ring-orange-200",
  LOST: "bg-red-50 text-red-700 ring-red-200",
  RETIRED: "bg-slate-100 text-slate-700 ring-slate-200",
  DISPOSED: "bg-zinc-100 text-zinc-700 ring-zinc-200",
};

function formatMoney(value: unknown) {
  if (value == null) return "Not set";
  const amount = Number(value);

  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
    : String(value);
}

function formatDate(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(value) : "Not set";
}

function currentHolder(asset: AssetRow) {
  const active = asset.allocations[0];
  if (!active) return "Unassigned";
  if (active.holder) return active.holder.name;
  if (active.department) return active.department.name;

  return "Assigned";
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = parseAssetFilters(params ?? {});
  const session = await getSession();
  const canRegister = hasRole(session, "ASSET_MANAGER");
  const [assets, categories, departments] = (await Promise.all([
    listAssets(filters),
    prisma.assetCategory.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.department.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])) as [AssetRow[], NamedOption[], NamedOption[]];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Assets</h1>
          <p className="text-sm text-muted-foreground">
            Register assets, search the directory, and see lifecycle ownership at a glance.
          </p>
        </div>
        <div className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
          {assets.length} {assets.length === 1 ? "asset" : "assets"} shown
        </div>
      </div>

      {canRegister ? (
        <Card>
          <CardHeader>
            <CardTitle>Register Asset</CardTitle>
          </CardHeader>
          <CardContent>
            <AssetRegistrationForm categories={categories} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Directory Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Input name="tag" defaultValue={filters.tag} placeholder="Asset tag or QR" />
            <Input name="serial" defaultValue={filters.serial} placeholder="Serial number" />
            <select
              name="category"
              defaultValue={filters.category}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={filters.status}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All statuses</option>
              {ASSET_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <select
              name="dept"
              defaultValue={filters.dept}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <Input name="location" defaultValue={filters.location} placeholder="Location" />
            <div className="flex gap-2 md:col-span-3 xl:col-span-6">
              <Button type="submit">Apply filters</Button>
              <a
                href="/assets"
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Reset
              </a>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Holder</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Bookable</th>
              <th className="px-4 py-3">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {assets.map((asset) => (
              <tr key={asset.id} className="align-top">
                <td className="px-4 py-3">
                  <div className="font-medium">{asset.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {asset.assetTag}
                    {asset.serialNumber ? ` - ${asset.serialNumber}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Acquired {formatDate(asset.acquisitionDate)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${statusStyles[asset.status]}`}
                  >
                    {asset.status.replaceAll("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3">{asset.category.name}</td>
                <td className="px-4 py-3">{currentHolder(asset)}</td>
                <td className="px-4 py-3">{asset.location ?? "Not set"}</td>
                <td className="px-4 py-3">{asset.isBookable ? "Yes" : "No"}</td>
                <td className="px-4 py-3">{formatMoney(asset.acquisitionCost)}</td>
              </tr>
            ))}
            {!assets.length ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                  No assets match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
