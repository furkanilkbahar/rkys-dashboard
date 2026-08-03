import {
  BarChart3,
  ChartSpline,
  Boxes,
  CalendarClock,
  Clock,
  Gift,
  Heart,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Receipt,
  Settings,
  Star,
  Store,
  Table2,
  Tablet,
  Tag,
  Truck,
  Users,
  UtensilsCrossed,
  Webhook,
} from "lucide-react";

import type { ModuleKey } from "@/lib/modules/keys";

/**
 * Faz 21 (§2.3): referans panonun 5 maddelik sidebar'ı bu ürüne ÖLÇEKLENMEZ —
 * burada 15 modül ve 33 admin sayfası var. Nav maddeleri anlam gruplarına
 * ayrıldı; SidebarNav bunları başlıklarla render eder ve üstüne arama koyar.
 *
 * Gruplama YALNIZCA sunum içindir. Modül/izin filtreleme mantığı değişmedi:
 * `moduleKey` alanı ve `enabledModules` filtresi aynen korunuyor (RULES #34).
 */
export const NAV_GROUPS = ["daily", "sales", "inventory", "channels", "integration", "management"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export const ADMIN_NAV_ITEMS = [
  { href: "/admin", labelKey: "dashboard", icon: LayoutDashboard, exact: true, moduleKey: null, group: "daily" },
  { href: "/admin/menu", labelKey: "menu", icon: UtensilsCrossed, exact: false, moduleKey: null, group: "daily" },
  { href: "/admin/tables", labelKey: "tables", icon: Table2, exact: false, moduleKey: null, group: "daily" },
  { href: "/admin/ratings", labelKey: "ratings", icon: Star, exact: false, moduleKey: null, group: "daily" },
  {
    href: "/admin/reservations",
    labelKey: "reservations",
    icon: CalendarClock,
    exact: false,
    moduleKey: "reservations" satisfies ModuleKey,
    group: "sales",
  },
  { href: "/admin/campaigns", labelKey: "campaigns", icon: Tag, exact: false, moduleKey: "campaigns" satisfies ModuleKey, group: "sales" },
  { href: "/admin/loyalty", labelKey: "loyalty", icon: Heart, exact: false, moduleKey: "crm_loyalty" satisfies ModuleKey, group: "sales" },
  { href: "/admin/gift-cards", labelKey: "giftCards", icon: Gift, exact: false, moduleKey: "gift_cards" satisfies ModuleKey, group: "sales" },
  { href: "/admin/ingredients", labelKey: "ingredients", icon: Boxes, exact: false, moduleKey: "inventory" satisfies ModuleKey, group: "inventory" },
  { href: "/admin/suppliers", labelKey: "suppliers", icon: Truck, exact: false, moduleKey: "inventory" satisfies ModuleKey, group: "inventory" },
  { href: "/admin/delivery-zones", labelKey: "deliveryZones", icon: MapPin, exact: false, moduleKey: "delivery" satisfies ModuleKey, group: "channels" },
  { href: "/admin/marketplace", labelKey: "marketplace", icon: Store, exact: false, moduleKey: "marketplace" satisfies ModuleKey, group: "channels" },
  { href: "/admin/kiosk", labelKey: "kiosk", icon: Tablet, exact: false, moduleKey: "kiosk" satisfies ModuleKey, group: "channels" },
  { href: "/admin/api-keys", labelKey: "apiKeys", icon: KeyRound, exact: false, moduleKey: "api_access" satisfies ModuleKey, group: "integration" },
  { href: "/admin/webhooks", labelKey: "webhooks", icon: Webhook, exact: false, moduleKey: "api_access" satisfies ModuleKey, group: "integration" },
  { href: "/admin/accounting", labelKey: "accounting", icon: Receipt, exact: false, moduleKey: "accounting_export" satisfies ModuleKey, group: "integration" },
  { href: "/admin/staff", labelKey: "staff", icon: Users, exact: false, moduleKey: null, group: "management" },
  { href: "/admin/scheduling", labelKey: "scheduling", icon: Clock, exact: false, moduleKey: "staff_scheduling" satisfies ModuleKey, group: "management" },
  { href: "/admin/reports", labelKey: "reports", icon: BarChart3, exact: false, moduleKey: null, group: "management" },
  // Faz 21: /analytics (Faz 5, D55) hiçbir yerden linklenmiyordu — bütün
  // Analitik Merkezi üründe erişilemezdi. Erişim yine `reports.revenue`
  // izniyle sayfanın kendisinde korunuyor (RULES #41).
  { href: "/analytics", labelKey: "analytics", icon: ChartSpline, exact: false, moduleKey: null, group: "management" },
  { href: "/admin/support", labelKey: "support", icon: LifeBuoy, exact: false, moduleKey: null, group: "management" },
  { href: "/admin/settings", labelKey: "settings", icon: Settings, exact: false, moduleKey: null, group: "management" },
] as const satisfies readonly {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  exact: boolean;
  moduleKey: ModuleKey | null;
  group: NavGroup;
}[];
