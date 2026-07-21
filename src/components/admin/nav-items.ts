import { CalendarClock, LayoutDashboard, Settings, Table2, Users, UtensilsCrossed } from "lucide-react";

import type { ModuleKey } from "@/lib/modules/keys";

export const ADMIN_NAV_ITEMS = [
  { href: "/admin", labelKey: "dashboard", icon: LayoutDashboard, exact: true, moduleKey: null },
  { href: "/admin/menu", labelKey: "menu", icon: UtensilsCrossed, exact: false, moduleKey: null },
  { href: "/admin/tables", labelKey: "tables", icon: Table2, exact: false, moduleKey: null },
  { href: "/admin/staff", labelKey: "staff", icon: Users, exact: false, moduleKey: null },
  {
    href: "/admin/reservations",
    labelKey: "reservations",
    icon: CalendarClock,
    exact: false,
    moduleKey: "reservations" satisfies ModuleKey,
  },
  { href: "/admin/settings", labelKey: "settings", icon: Settings, exact: false, moduleKey: null },
] as const;
