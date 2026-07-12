import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  PackagePlus,
  Send,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { getSession } from "@/lib/session";
import { getDashboardKpis } from "@/lib/insights";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetTag } from "@/components/ui/asset-tag";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Tone = "brand" | "success" | "warning" | "neutral";

const toneTile: Record<Tone, string> = {
  brand: "bg-brand/10 text-brand",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  neutral: "bg-muted text-muted-foreground",
};

const KPI_META: Record<string, { icon: LucideIcon; tone: Tone; href?: string }> = {
  assetsAvailable: { icon: CheckCircle2, tone: "success", href: "/assets" },
  assetsAllocated: { icon: ArrowLeftRight, tone: "brand", href: "/allocations" },
  maintenanceToday: { icon: Wrench, tone: "warning", href: "/maintenance" },
  activeBookings: { icon: CalendarClock, tone: "brand", href: "/bookings" },
  pendingTransfers: { icon: Send, tone: "warning", href: "/allocations" },
  upcomingReturns: { icon: Clock, tone: "neutral", href: "/allocations" },
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const dashboard = await getDashboardKpis(session);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dashboard.scopeLabel} · {session.name} · {prettyRole(session.role)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/assets">
              <PackagePlus /> Register asset
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/bookings">
              <CalendarClock /> Book resource
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/maintenance">
              <Wrench /> Raise maintenance
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI grid */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {dashboard.kpis.map((kpi) => {
          const meta = KPI_META[kpi.key] ?? { icon: CheckCircle2, tone: "neutral" as Tone };
          return <MetricCard key={kpi.key} label={kpi.label} value={kpi.value} {...meta} />;
        })}

        <MetricCard
          label="Overdue Returns"
          value={dashboard.overdueReturns}
          icon={AlertTriangle}
          tone="warning"
          href="/allocations"
          alert={dashboard.overdueReturns > 0}
        />
        <MetricCard
          label="Unread Notifications"
          value={dashboard.unreadNotifications}
          icon={Bell}
          tone="brand"
          href="/notifications"
        />
      </section>

      {/* Activity */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Recent activity</h2>
            <p className="text-sm text-muted-foreground">The latest state changes across your scope.</p>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href="/notifications">View all</Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            {dashboard.recentActivity.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.recentActivity.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="font-medium">{prettyAction(activity.action)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {activity.actor?.name ?? "System"}
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">{activity.entityType}</span>
                        {activity.entityId ? (
                          <AssetTag muted className="ml-2">
                            {shortId(activity.entityId)}
                          </AssetTag>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {formatDateTime(activity.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
  href,
  alert,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: Tone;
  href?: string;
  alert?: boolean;
}) {
  const inner = (
    <Card
      className={cn(
        "h-full transition-colors",
        href && "hover:border-brand/40",
        alert && "border-destructive/40 bg-destructive/[0.04]"
      )}
    >
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-md",
            alert ? "bg-destructive/10 text-destructive" : toneTile[tone]
          )}
        >
          <Icon className="size-4" />
        </span>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-3xl font-semibold tabular-nums tracking-tight",
            alert && "text-destructive"
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Clock className="size-5" />
      </div>
      <p className="mt-2 text-sm font-medium">No activity yet</p>
      <p className="text-sm text-muted-foreground">
        Actions across assets, bookings and audits will appear here.
      </p>
    </div>
  );
}

function prettyRole(role: string) {
  return role
    .split("_")
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join(" ");
}

function prettyAction(action: string) {
  return action
    .split("_")
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join(" ");
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
