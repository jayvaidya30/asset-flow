"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Option = {
  id: string;
  label: string;
};

type ApiResult = { ok: true; data: unknown } | { ok: false; error: string; details?: unknown };

export function AllocationForm({
  assets,
  employees,
  departments,
}: {
  assets: Option[];
  employees: Option[];
  departments: Option[];
}) {
  const router = useRouter();
  const [holderType, setHolderType] = useState<"employee" | "department">("employee");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const selectedHolderId = String(formData.get("holderId") ?? "").trim();
    const payload = {
      assetId: String(formData.get("assetId") ?? "").trim(),
      expectedReturnDate: String(formData.get("expectedReturnDate") ?? "").trim(),
      holderId: holderType === "employee" ? selectedHolderId : undefined,
      departmentId: holderType === "department" ? selectedHolderId : undefined,
    };

    try {
      const response = await fetch("/api/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiResult;

      if (!result.ok) {
        setError(result.error);
        return;
      }

      form.reset();
      setMessage("Allocation recorded");
      router.refresh();
    } catch {
      setError("Could not create allocation. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const holders = holderType === "employee" ? employees : departments;

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1 text-sm font-medium">
        Asset
        <select
          name="assetId"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select asset</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.label}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium">
        Holder type
        <select
          value={holderType}
          onChange={(event) => setHolderType(event.target.value as "employee" | "department")}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="employee">Employee</option>
          <option value="department">Department</option>
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium">
        Holder
        <select
          name="holderId"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select holder</option>
          {holders.map((holder) => (
            <option key={holder.id} value={holder.id}>
              {holder.label}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium">
        Expected return
        <Input name="expectedReturnDate" type="date" />
      </label>
      <div className="flex items-center justify-end gap-3 md:col-span-2 xl:col-span-4">
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" disabled={isSubmitting || !assets.length}>
          {isSubmitting ? "Allocating..." : "Allocate asset"}
        </Button>
      </div>
    </form>
  );
}

export function ReturnAllocationForm({ allocationId }: { allocationId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      checkInCondition: String(formData.get("checkInCondition") ?? "").trim(),
      checkInNotes: String(formData.get("checkInNotes") ?? "").trim(),
    };

    try {
      const response = await fetch(`/api/allocations/${allocationId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiResult;

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.refresh();
    } catch {
      setError("Could not return this asset. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2 md:grid-cols-[160px_1fr_auto]">
      <Input name="checkInCondition" placeholder="Condition" />
      <Input name="checkInNotes" placeholder="Check-in notes" />
      <Button type="submit" size="sm" disabled={isSubmitting}>
        {isSubmitting ? "Returning..." : "Return"}
      </Button>
      {error ? <p className="text-sm text-red-600 md:col-span-3">{error}</p> : null}
    </form>
  );
}

export function TransferRequestForm({
  allocations,
  employees,
}: {
  allocations: Option[];
  employees: Option[];
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      assetId: String(formData.get("assetId") ?? "").trim(),
      toEmployeeId: String(formData.get("toEmployeeId") ?? "").trim(),
      reason: String(formData.get("reason") ?? "").trim(),
    };

    try {
      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiResult;

      if (!result.ok) {
        setError(result.error);
        return;
      }

      form.reset();
      setMessage("Transfer requested");
      router.refresh();
    } catch {
      setError("Could not request transfer. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1 text-sm font-medium">
        Current allocation
        <select
          name="assetId"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select allocated asset</option>
          {allocations.map((allocation) => (
            <option key={allocation.id} value={allocation.id}>
              {allocation.label}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium">
        Transfer to
        <select
          name="toEmployeeId"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.label}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium xl:col-span-2">
        Reason
        <Input name="reason" placeholder="Replacement, role change, handoff..." />
      </label>
      <div className="flex items-center justify-end gap-3 md:col-span-2 xl:col-span-4">
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" disabled={isSubmitting || !allocations.length}>
          {isSubmitting ? "Requesting..." : "Request transfer"}
        </Button>
      </div>
    </form>
  );
}

export function TransferDecisionForm({ transferId }: { transferId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "reject") {
    setIsSubmitting(action);
    setError(null);

    try {
      const response = await fetch(`/api/transfers/${transferId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json()) as ApiResult;

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.refresh();
    } catch {
      setError("Could not update transfer. Try again.");
    } finally {
      setIsSubmitting(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => decide("approve")} disabled={!!isSubmitting}>
          {isSubmitting === "approve" ? "Approving..." : "Approve"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => decide("reject")}
          disabled={!!isSubmitting}
        >
          {isSubmitting === "reject" ? "Rejecting..." : "Reject"}
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
