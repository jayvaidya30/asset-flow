import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Brand } from "@/components/brand";
import { SidebarNav } from "@/components/sidebar-nav";
import { TopBar } from "@/components/top-bar";
import type { Role } from "@/components/nav-config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = { name: session.name, email: session.email, role: session.role as Role };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav role={user.role} />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <p className="px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            v1.0 · Hackathon build
          </p>
        </div>
      </aside>

      {/* Content column */}
      <div className="flex min-h-screen flex-col">
        <TopBar user={user} />
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
