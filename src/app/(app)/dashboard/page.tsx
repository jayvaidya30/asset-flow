import { getSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Track 4 owns this screen. Replace the placeholder KPIs with real aggregate queries:
// Assets Available, Assets Allocated, Maintenance Today, Active Bookings,
// Pending Transfers, Upcoming Returns + an overdue-returns section.
export default async function DashboardPage() {
  const session = await getSession();

  const kpis = [
    { label: "Assets Available", value: "—" },
    { label: "Assets Allocated", value: "—" },
    { label: "Maintenance Today", value: "—" },
    { label: "Active Bookings", value: "—" },
    { label: "Pending Transfers", value: "—" },
    { label: "Upcoming Returns", value: "—" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome, {session?.name} · {session?.role}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
