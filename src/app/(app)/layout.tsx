import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasRole } from "@/lib/rbac";
import type { SessionPayload } from "@/lib/auth";

// Shared authenticated shell (Track 1). Nav links are role-filtered.
const NAV: { href: string; label: string; roles?: SessionPayload["role"][] }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/setup", label: "Org Setup", roles: ["ADMIN"] },
  { href: "/assets", label: "Assets" },
  { href: "/allocations", label: "Allocations" },
  { href: "/bookings", label: "Bookings" },
  { href: "/maintenance", label: "Maintenance" },
  { href: "/audits", label: "Audits" },
  { href: "/reports", label: "Reports", roles: ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD"] },
  { href: "/notifications", label: "Notifications" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const links = NAV.filter((l) => !l.roles || hasRole(session, ...l.roles));

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-card p-4">
        <div className="mb-6 text-lg font-bold">AssetFlow</div>
        <nav className="space-y-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block rounded-md px-3 py-2 text-sm hover:bg-secondary"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <form action="/api/auth/logout" method="post" className="mt-8">
          <button type="submit" className="text-sm text-muted-foreground hover:underline">
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
