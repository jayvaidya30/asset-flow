import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getActivity, getNotifications } from "@/lib/insights";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetTag } from "@/components/ui/asset-tag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MarkAllReadButton, MarkNotificationReadButton } from "./notification-actions";

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [notifications, activity] = await Promise.all([
    getNotifications(session, 75),
    getActivity(session, 75),
  ]);
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity &amp; Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount} unread · {notifications.length} total
          </p>
        </div>
        <MarkAllReadButton disabled={unreadCount === 0} />
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.length ? (
              notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={
                    notification.isRead
                      ? "rounded-lg border p-4"
                      : "rounded-lg border border-brand/30 bg-brand/5 p-4"
                  }
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {!notification.isRead && (
                          <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                        )}
                        <h2 className="font-medium">{notification.title}</h2>
                        <Badge variant={notification.isRead ? "outline" : "brand"}>
                          {prettyType(notification.type)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(notification.createdAt)}
                        {notification.linkUrl ? ` · ${notification.linkUrl}` : ""}
                      </p>
                    </div>
                    {!notification.isRead && <MarkNotificationReadButton id={notification.id} />}
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-md border p-6 text-sm text-muted-foreground">
                No notifications yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activity.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead className="text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{prettyType(item.action)}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          {item.entityType}
                          {item.entityId ? <AssetTag muted>{item.entityId.slice(0, 8)}</AssetTag> : null}
                        </div>
                      </TableCell>
                      <TableCell>{item.actor?.name ?? "System"}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDateTime(item.createdAt)}
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

function prettyType(value: string) {
  return value
    .split("_")
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join(" ");
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
