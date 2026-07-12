import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "info" | "warning" | "danger" | "neutral";

const toneStyles: Record<Tone, { wrap: string; dot: string }> = {
  success: { wrap: "border-success/25 bg-success/10 text-success", dot: "bg-success" },
  info: { wrap: "border-brand/25 bg-brand/10 text-brand", dot: "bg-brand" },
  warning: { wrap: "border-warning/30 bg-warning/15 text-warning", dot: "bg-warning" },
  danger: { wrap: "border-destructive/25 bg-destructive/10 text-destructive", dot: "bg-destructive" },
  neutral: { wrap: "border-border bg-muted/60 text-muted-foreground", dot: "bg-muted-foreground" },
};

// Every domain status → a tone, so color is consistent wherever a status appears.
const STATUS_TONE: Record<string, Tone> = {
  // AssetStatus
  AVAILABLE: "success",
  ALLOCATED: "info",
  RESERVED: "warning",
  UNDER_MAINTENANCE: "warning",
  LOST: "danger",
  RETIRED: "neutral",
  DISPOSED: "neutral",
  // AllocationStatus
  ACTIVE: "info",
  RETURNED: "neutral",
  OVERDUE: "danger",
  // TransferStatus
  REQUESTED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  COMPLETED: "neutral",
  // BookingStatus
  UPCOMING: "info",
  ONGOING: "success",
  CANCELLED: "danger",
  // MaintenanceStatus
  PENDING: "warning",
  TECHNICIAN_ASSIGNED: "info",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  // MaintenancePriority
  LOW: "neutral",
  MEDIUM: "warning",
  HIGH: "danger",
  // AuditResult
  VERIFIED: "success",
  MISSING: "danger",
  DAMAGED: "warning",
  // AuditCycleStatus
  OPEN: "info",
  CLOSED: "neutral",
};

function humanize(value: string) {
  return value
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

export function StatusBadge({
  status,
  tone,
  label,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  status: string;
  tone?: Tone;
  label?: string;
}) {
  const resolved = tone ?? STATUS_TONE[status] ?? "neutral";
  const styles = toneStyles[resolved];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        styles.wrap,
        className
      )}
      {...props}
    >
      <span className={cn("size-1.5 rounded-full", styles.dot)} />
      {label ?? humanize(status)}
    </span>
  );
}
