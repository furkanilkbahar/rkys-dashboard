import { LayoutDashboard, Settings, Table2, Users, UtensilsCrossed } from "lucide-react";

export const ADMIN_NAV_ITEMS = [
  { href: "/admin", labelKey: "dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/menu", labelKey: "menu", icon: UtensilsCrossed, exact: false },
  { href: "/admin/tables", labelKey: "tables", icon: Table2, exact: false },
  { href: "/admin/staff", labelKey: "staff", icon: Users, exact: false },
  { href: "/admin/settings", labelKey: "settings", icon: Settings, exact: false },
] as const;
