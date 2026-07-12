import { Boxes } from "lucide-react";
import { AssetRegistrationForm } from "./asset-registration-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { AssetTag } from "@/components/ui/asset-tag";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function formatMoney(value: unknown) {
  if (value == null) return "—";
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
          <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Register assets, search the directory, and see lifecycle ownership at a glance.
          </p>
        </div>
        <Badge variant="secondary" className="self-start px-2.5 py-1 sm:self-auto">
          {assets.length} {assets.length === 1 ? "asset" : "assets"} shown
        </Badge>
      </div>

      {canRegister ? (
        <Card>
          <CardHeader>
            <CardTitle>Register asset</CardTitle>
          </CardHeader>
          <CardContent>
            <AssetRegistrationForm categories={categories} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-5">
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Input name="tag" defaultValue={filters.tag} placeholder="Asset tag or QR" />
            <Input name="serial" defaultValue={filters.serial} placeholder="Serial number" />
            <NativeSelect name="category" defaultValue={filters.category}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect name="status" defaultValue={filters.status}>
              <option value="">All statuses</option>
              {ASSET_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect name="dept" defaultValue={filters.dept}>
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </NativeSelect>
            <Input name="location" defaultValue={filters.location} placeholder="Location" />
            <div className="flex gap-2 md:col-span-3 xl:col-span-6">
              <Button type="submit">Apply filters</Button>
              <Button asChild variant="outline">
                <a href="/assets">Reset</a>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Holder</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Bookable</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    <div className="font-medium">{asset.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <AssetTag>{asset.assetTag}</AssetTag>
                      {asset.serialNumber ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {asset.serialNumber}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Acquired {formatDate(asset.acquisitionDate)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={asset.status} />
                  </TableCell>
                  <TableCell>{asset.category.name}</TableCell>
                  <TableCell>{currentHolder(asset)}</TableCell>
                  <TableCell className="text-muted-foreground">{asset.location ?? "Not set"}</TableCell>
                  <TableCell>
                    {asset.isBookable ? (
                      <Badge variant="brand">Bookable</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(asset.acquisitionCost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!assets.length ? (
            <div className="flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Boxes className="size-5" />
              </div>
              <p className="mt-2 text-sm font-medium">No assets match your filters</p>
              <p className="text-sm text-muted-foreground">
                Try clearing filters, or register a new asset above.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
