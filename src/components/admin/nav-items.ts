import { BarChart3, CalendarClock, Heart, LayoutDashboard, LifeBuoy, Settings, Star, Table2, Tag, Users, UtensilsCrossed } from "lucide-react";

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
  { href: "/admin/ratings", labelKey: "ratings", icon: Star, exact: false, moduleKey: null },
  { href: "/admin/campaigns", labelKey: "campaigns", icon: Tag, exact: false, moduleKey: "campaigns" satisfies ModuleKey },
  { href: "/admin/loyalty", labelKey: "loyalty", icon: Heart, exact: false, moduleKey: "crm_loyalty" satisfies ModuleKey },
  { href: "/admin/reports", labelKey: "reports", icon: BarChart3, exact: false, moduleKey: null },
  { href: "/admin/support", labelKey: "support", icon: LifeBuoy, exact: false, moduleKey: null },
  { href: "/admin/settings", labelKey: "settings", icon: Settings, exact: false, moduleKey: null },
] as const;
