import {
  Bell,
  Building2,
  ClipboardList,
  KeyRound,
  LayoutGrid,
  LifeBuoy,
  Mail,
  Settings,
  ShieldAlert,
  UserRoundCheck,
} from "lucide-react";

/**
 * Faz 21 (§2.3) — platform navigasyonu.
 *
 * Eskiden layout'ta 10 tane elle yazılmış <Link> tek satırda duruyordu;
 * dar ekranda taşıyor ve admin'le aynı dili konuşmuyordu. Admin'deki
 * `nav-items.ts` deseniyle aynı yapıya alındı: gruplu, ikonlu, tek kaynak.
 */
export const PLATFORM_NAV_GROUPS = ["tenants", "commerce", "support", "system"] as const;
export type PlatformNavGroup = (typeof PLATFORM_NAV_GROUPS)[number];

export const PLATFORM_NAV_ITEMS = [
  { href: "/platform", labelKey: "tenants", icon: Building2, exact: true, group: "tenants" },
  { href: "/platform/pending-tenants", labelKey: "pendingTenants", icon: UserRoundCheck, exact: false, group: "tenants" },
  { href: "/platform/plans", labelKey: "plans", icon: LayoutGrid, exact: false, group: "commerce" },
  { href: "/platform/module-requests", labelKey: "moduleRequests", icon: ClipboardList, exact: false, group: "commerce" },
  { href: "/platform/licenses", labelKey: "licenses", icon: KeyRound, exact: false, group: "commerce" },
  { href: "/platform/support", labelKey: "support", icon: LifeBuoy, exact: false, group: "support" },
  { href: "/platform/contact-requests", labelKey: "contactRequests", icon: Mail, exact: false, group: "support" },
  { href: "/platform/announcements", labelKey: "announcements", icon: Bell, exact: false, group: "system" },
  { href: "/platform/incidents", labelKey: "incidents", icon: ShieldAlert, exact: false, group: "system" },
  { href: "/platform/settings", labelKey: "settings", icon: Settings, exact: false, group: "system" },
] as const satisfies readonly {
  href: string;
  labelKey: string;
  icon: typeof Building2;
  exact: boolean;
  group: PlatformNavGroup;
}[];
