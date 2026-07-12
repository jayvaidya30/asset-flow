import {
  AllocationForm,
  ReturnAllocationForm,
  TransferDecisionForm,
  TransferRequestForm,
} from "./allocation-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { holderLabel, isOverdue, listActiveAllocations } from "@/lib/allocations";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { getSession } from "@/lib/session";

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
  const transferWhere = canApproveTransfer
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
          <h1 className="text-2xl font-semibold">Allocations & Returns</h1>
          <p className="text-sm text-muted-foreground">
            Assign assets to employees or departments, block double-holds, and close returns with condition notes.
          </p>
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-md border text-sm">
          <div className="px-3 py-2">
            <div className="text-xs text-muted-foreground">Active</div>
            <div className="font-semibold">{allocations.length}</div>
          </div>
          <div className="border-l px-3 py-2">
            <div className="text-xs text-muted-foreground">Overdue</div>
            <div className={overdueCount ? "font-semibold text-red-600" : "font-semibold"}>{overdueCount}</div>
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
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3">Reason</th>
                  {canApproveTransfer ? <th className="px-4 py-3">Decision</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                {transfers.map((transfer) => (
                  <tr key={transfer.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{transfer.asset.name}</div>
                      <div className="text-xs text-muted-foreground">{transfer.asset.assetTag}</div>
                    </td>
                    <td className="px-4 py-3">
                      {transfer.fromEmployee ? (
                        <>
                          <div>{transfer.fromEmployee.name}</div>
                          <div className="text-xs text-muted-foreground">{transfer.fromEmployee.email}</div>
                        </>
                      ) : (
                        "Department allocation"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>{transfer.toEmployee.name}</div>
                      <div className="text-xs text-muted-foreground">{transfer.toEmployee.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{formatDateTime(transfer.createdAt)}</div>
                      <div className="text-xs text-muted-foreground">By {transfer.requestedBy.name}</div>
                    </td>
                    <td className="px-4 py-3">{transfer.reason || "Not provided"}</td>
                    {canApproveTransfer ? (
                      <td className="px-4 py-3">
                        <TransferDecisionForm transferId={transfer.id} />
                      </td>
                    ) : null}
                  </tr>
                ))}
                {!transfers.length ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-muted-foreground"
                      colSpan={canApproveTransfer ? 6 : 5}
                    >
                      No pending transfer requests.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Allocations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Holder</th>
                  <th className="px-4 py-3">Allocated</th>
                  <th className="px-4 py-3">Expected return</th>
                  <th className="px-4 py-3">Location</th>
                  {canReturn ? <th className="px-4 py-3">Return</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                {allocations.map((allocation) => {
                  const overdue = isOverdue(allocation.expectedReturnDate);

                  return (
                    <tr key={allocation.id} className={overdue ? "bg-red-50/60 align-top" : "align-top"}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{allocation.asset.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {allocation.asset.assetTag} - {allocation.asset.category.name}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{holderLabel(allocation)}</div>
                        {allocation.holder ? (
                          <div className="text-xs text-muted-foreground">{allocation.holder.email}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div>{formatDateTime(allocation.allocatedAt)}</div>
                        <div className="text-xs text-muted-foreground">By {allocation.allocatedBy.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={overdue ? "font-medium text-red-700" : ""}>
                          {formatDate(allocation.expectedReturnDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{allocation.asset.location ?? "Not set"}</td>
                      {canReturn ? (
                        <td className="min-w-[360px] px-4 py-3">
                          <ReturnAllocationForm allocationId={allocation.id} />
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
                {!allocations.length ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-muted-foreground"
                      colSpan={canReturn ? 6 : 5}
                    >
                      No active allocations yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
