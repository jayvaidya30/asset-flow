import {
  AllocationForm,
  ReturnAllocationForm,
  TransferDecisionForm,
  TransferRequestForm,
} from "./allocation-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetTag } from "@/components/ui/asset-tag";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { holderLabel, isOverdue, listActiveAllocations } from "@/lib/allocations";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import type { Prisma } from "@prisma/client";

type AllocationRow = {
  id: string;
  allocatedAt: Date;
  expectedReturnDate: Date | null;
  asset: {
    id: string;
    assetTag: string;
    name: string;
    status: string;
    location: string | null;
    category: { name: string };
  };
  holder: { id: string; name: string; email: string } | null;
  department: { id: string; name: string } | null;
  allocatedBy: { id: string; name: string };
};

type TransferRow = {
  id: string;
  status: string;
  reason: string | null;
  createdAt: Date;
  asset: { id: string; assetTag: string; name: string };
  fromEmployee: { id: string; name: string; email: string } | null;
  toEmployee: { id: string; name: string; email: string };
  requestedBy: { id: string; name: string; email: string };
};

type Option = {
  id: string;
  label: string;
};

function formatDate(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(value) : "Not set";
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function Page() {
  const session = await getSession();
  const canAllocate = hasRole(session, "ASSET_MANAGER", "DEPARTMENT_HEAD");
  const canReturn = hasRole(session, "ASSET_MANAGER");
  const canApproveTransfer = hasRole(session, "ASSET_MANAGER", "DEPARTMENT_HEAD");
  const transferWhere: Prisma.TransferWhereInput = canApproveTransfer
    ? { status: "REQUESTED" }
    : {
        status: "REQUESTED",
        OR: [
          { requestedById: session?.sub },
          { fromEmployeeId: session?.sub },
          { toEmployeeId: session?.sub },
        ],
      };
  const [allocations, transfers, assets, employees, departments] = (await Promise.all([
    listActiveAllocations(),
    prisma.transfer.findMany({
      where: transferWhere,
      orderBy: { createdAt: "desc" },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        fromEmployee: { select: { id: true, name: true, email: true } },
        toEmployee: { select: { id: true, name: true, email: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.asset.findMany({
      where: {
        status: { in: ["AVAILABLE", "RESERVED"] },
        allocations: { none: { status: "ACTIVE" } },
      },
      orderBy: [{ assetTag: "asc" }],
      select: { id: true, assetTag: true, name: true },
    }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.department.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])) as [
    AllocationRow[],
    TransferRow[],
    { id: string; assetTag: string; name: string }[],
    { id: string; name: string; email: string }[],
    { id: string; name: string }[],
  ];
  const overdueCount = allocations.filter((allocation) => isOverdue(allocation.expectedReturnDate)).length;
  const assetOptions: Option[] = assets.map((asset) => ({
    id: asset.id,
    label: `${asset.assetTag} - ${asset.name}`,
  }));
  const employeeOptions: Option[] = employees.map((employee) => ({
    id: employee.id,
    label: `${employee.name} (${employee.email})`,
  }));
  const departmentOptions: Option[] = departments.map((department) => ({
    id: department.id,
    label: department.name,
  }));
  const transferAllocationOptions: Option[] = allocations.map((allocation) => ({
    id: allocation.asset.id,
    label: `${allocation.asset.assetTag} - ${allocation.asset.name} from ${holderLabel(allocation)}`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Allocations &amp; Returns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Assign assets to employees or departments, block double-holds, and close returns with condition notes.
          </p>
        </div>
        <div className="grid grid-cols-2 divide-x overflow-hidden rounded-lg border text-sm">
          <div className="px-4 py-2">
            <div className="text-xs text-muted-foreground">Active</div>
            <div className="text-lg font-semibold tabular-nums">{allocations.length}</div>
          </div>
          <div className="px-4 py-2">
            <div className="text-xs text-muted-foreground">Overdue</div>
            <div className={overdueCount ? "text-lg font-semibold tabular-nums text-destructive" : "text-lg font-semibold tabular-nums"}>
              {overdueCount}
            </div>
          </div>
        </div>
      </div>

      {canAllocate ? (
        <Card>
          <CardHeader>
            <CardTitle>Allocate Asset</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationForm assets={assetOptions} employees={employeeOptions} departments={departmentOptions} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Request Transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <TransferRequestForm allocations={transferAllocationOptions} employees={employeeOptions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Transfers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Reason</TableHead>
                {canApproveTransfer ? <TableHead>Decision</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell>
                    <div className="font-medium">{transfer.asset.name}</div>
                    <AssetTag muted className="mt-1">{transfer.asset.assetTag}</AssetTag>
                  </TableCell>
                  <TableCell>
                    {transfer.fromEmployee ? (
                      <>
                        <div>{transfer.fromEmployee.name}</div>
                        <div className="text-xs text-muted-foreground">{transfer.fromEmployee.email}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Department allocation</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>{transfer.toEmployee.name}</div>
                    <div className="text-xs text-muted-foreground">{transfer.toEmployee.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="tabular-nums">{formatDateTime(transfer.createdAt)}</div>
                    <div className="text-xs text-muted-foreground">By {transfer.requestedBy.name}</div>
                  </TableCell>
                  <TableCell className="max-w-56 text-muted-foreground">
                    {transfer.reason || "Not provided"}
                  </TableCell>
                  {canApproveTransfer ? (
                    <TableCell>
                      <TransferDecisionForm transferId={transfer.id} />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!transfers.length ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No pending transfer requests.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Allocations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Holder</TableHead>
                <TableHead>Allocated</TableHead>
                <TableHead>Expected return</TableHead>
                <TableHead>Location</TableHead>
                {canReturn ? <TableHead>Return</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocations.map((allocation) => {
                const overdue = isOverdue(allocation.expectedReturnDate);

                return (
                  <TableRow key={allocation.id} className={overdue ? "bg-destructive/[0.04]" : undefined}>
                    <TableCell>
                      <div className="font-medium">{allocation.asset.name}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <AssetTag muted>{allocation.asset.assetTag}</AssetTag>
                        <span className="text-xs text-muted-foreground">{allocation.asset.category.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{holderLabel(allocation)}</div>
                      {allocation.holder ? (
                        <div className="text-xs text-muted-foreground">{allocation.holder.email}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="tabular-nums">{formatDateTime(allocation.allocatedAt)}</div>
                      <div className="text-xs text-muted-foreground">By {allocation.allocatedBy.name}</div>
                    </TableCell>
                    <TableCell>
                      {overdue ? (
                        <StatusBadge status="OVERDUE" label={`${formatDate(allocation.expectedReturnDate)}`} />
                      ) : (
                        <span className="tabular-nums">{formatDate(allocation.expectedReturnDate)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{allocation.asset.location ?? "Not set"}</TableCell>
                    {canReturn ? (
                      <TableCell className="min-w-[360px]">
                        <ReturnAllocationForm allocationId={allocation.id} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!allocations.length ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No active allocations yet.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
