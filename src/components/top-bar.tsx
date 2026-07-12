"use client";

import { usePathname } from "next/navigation";
import { MobileNav } from "@/components/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { titleForPath } from "@/components/nav-config";
import type { Role } from "@/components/nav-config";

export function TopBar({
  user,
}: {
  user: { name: string; email: string; role: Role };
}) {
  const pathname = usePathname();
  const title = titleForPath(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
      <MobileNav role={user.role} />
      <div className="flex items-center gap-2 text-sm">
        <span className="hidden font-mono text-xs uppercase tracking-widest text-muted-foreground sm:inline">
          AssetFlow
        </span>
        <span className="hidden text-muted-foreground/50 sm:inline">/</span>
        <span className="font-medium">{title}</span>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <div className="mx-1 h-6 w-px bg-border" />
        <UserMenu name={user.name} email={user.email} role={user.role} />
      </div>
    </header>
  );
}
