import {
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  CalendarClock,
  Wrench,
  ClipboardCheck,
  BarChart3,
  Bell,
  Building2,
  type LucideIcon,
} from "lucide-react";

export type Role = "ADMIN" | "ASSET_MANAGER" | "DEPARTMENT_HEAD" | "EMPLOYEE";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Assets",
    items: [
      { href: "/assets", label: "Assets", icon: Boxes },
      { href: "/allocations", label: "Allocations", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/bookings", label: "Bookings", icon: CalendarClock },
      { href: "/maintenance", label: "Maintenance", icon: Wrench },
      { href: "/audits", label: "Audits", icon: ClipboardCheck },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        href: "/reports",
        label: "Reports",
        icon: BarChart3,
        roles: ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD"],
      },
      { href: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Administration",
    items: [{ href: "/setup", label: "Org Setup", icon: Building2, roles: ["ADMIN"] }],
  },
];

export function canSee(role: Role | undefined, roles?: Role[]) {
  if (!roles || roles.length === 0) return true;
  return role !== undefined && roles.includes(role);
}

/** Flat lookup for page titles (breadcrumb / top bar). */
export function titleForPath(pathname: string): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) return item.label;
    }
  }
  return "AssetFlow";
}
