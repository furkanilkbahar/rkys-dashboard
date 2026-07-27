import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PlatformLogoutButton } from "@/components/platform/platform-logout-button";
import { requirePlatformAdmin } from "@/lib/auth/platformGuard";

export default async function PlatformDashboardLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  const t = await getTranslations("platform");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background px-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold">{t("title")}</span>
          <nav className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link href="/platform" className="hover:text-foreground">
              {t("nav.tenants")}
            </Link>
            <Link href="/platform/pending-tenants" className="hover:text-foreground">
              {t("nav.pendingTenants")}
            </Link>
            <Link href="/platform/plans" className="hover:text-foreground">
              {t("nav.plans")}
            </Link>
            <Link href="/platform/module-requests" className="hover:text-foreground">
              {t("nav.moduleRequests")}
            </Link>
            <Link href="/platform/announcements" className="hover:text-foreground">
              {t("nav.announcements")}
            </Link>
            <Link href="/platform/settings" className="hover:text-foreground">
              {t("nav.settings")}
            </Link>
            <Link href="/platform/licenses" className="hover:text-foreground">
              {t("nav.licenses")}
            </Link>
            <Link href="/platform/support" className="hover:text-foreground">
              {t("nav.support")}
            </Link>
            <Link href="/platform/incidents" className="hover:text-foreground">
              {t("nav.incidents")}
            </Link>
          </nav>
        </div>
        <PlatformLogoutButton />
      </header>
      <main className="flex-1 p-4 lg:p-6">{children}</main>
    </div>
  );
}
