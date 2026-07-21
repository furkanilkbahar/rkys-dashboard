import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { CashierLogoutButton } from "@/components/cashier/logout-button";
import { requireCashierActor } from "@/lib/auth/cashierGuard";

export default async function CashierLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireCashierActor();
  const t = await getTranslations("cashier");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background px-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold">{t("title")}</span>
          <nav className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link href="/cashier" className="hover:text-foreground">
              {t("nav.shift")}
            </Link>
            <Link href="/cashier/order" className="hover:text-foreground">
              {t("nav.order")}
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium capitalize text-muted-foreground">{actor.role}</span>
          <CashierLogoutButton />
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
