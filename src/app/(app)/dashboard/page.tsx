import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getDashboardKpis } from "@/lib/insights";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const dashboard = await getDashboardKpis(session);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {dashboard.scopeLabel} · {session.name} · {prettyRole(session.role)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/assets">Register Asset</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/bookings">Book Resource</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/maintenance">Raise Maintenance</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboard.kpis.map((kpi) => (
          <Card key={kpi.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
        <Card className={dashboard.overdueReturns ? "border-red-200 bg-red-50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Returns</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-3">
            <p className={dashboard.overdueReturns ? "text-3xl font-bold text-red-700" : "text-3xl font-bold"}>
              {dashboard.overdueReturns}
            </p>
            {dashboard.overdueReturns > 0 && <Badge variant="destructive">Needs action</Badge>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unread Notifications</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-3">
            <p className="text-3xl font-bold">{dashboard.unreadNotifications}</p>
            <Button asChild size="sm" variant="ghost">
              <Link href="/notifications">Open</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
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
                      <TableCell>{activity.actor?.name ?? "System"}</TableCell>
                      <TableCell>
                        {activity.entityType}
                        {activity.entityId ? <span className="text-muted-foreground"> · {shortId(activity.entityId)}</span> : null}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDateTime(activity.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-sm text-muted-foreground">No activity has been recorded yet.</div>
            )}
          </CardContent>
        </Card>
      </section>
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
