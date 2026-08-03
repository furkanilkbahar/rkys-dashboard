import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { CashierLogoutButton } from "@/components/cashier/logout-button";
import { requireCashierActor } from "@/lib/auth/cashierGuard";

/**
 * Faz 21 Adım 3 — kasa chrome'u.
 *
 * Diğer üç operasyon panelinden farkı kalıcı bir sekme navigasyonu olması
 * (vardiya / sipariş / ödeme), bu yüzden `OpsShell` yerine kendi başlığını
 * kurar — ama aynı `.ops-surface` sınıfını ve aynı Katman 2b token'larını
 * kullanır: dokunma hedefi 44px, tipografi ölçeği ortak.
 *
 * Aktif sekme vurgusu sunucuda hesaplanamaz (pathname yalnızca client'ta);
 * bunun için bir client bileşeni eklemek kasa ekranını gereksiz hidrasyona
 * sokardı — sekmeler nötr bırakıldı.
 */
export default async function CashierLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireCashierActor();
  const t = await getTranslations("cashier");

  const tabs = [
    { href: "/cashier", label: t("nav.shift") },
    { href: "/cashier/order", label: t("nav.order") },
    { href: "/cashier/pay", label: t("nav.pay") },
  ];

  return (
    <div className="ops-surface flex min-h-dvh flex-col bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <header className="sticky top-0 z-20 border-b border-[var(--surface-line)] bg-[var(--surface-bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">{t("title")}</h1>

          <nav className="flex items-center gap-1">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="rounded-[var(--r-sm)] px-3 py-2 text-[14px] font-medium text-[var(--surface-fg-muted)] no-underline transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-panel)] hover:text-[var(--surface-fg)]"
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-[13px] font-medium text-[var(--surface-fg-muted)] capitalize">{actor.role}</span>
            <CashierLogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4 sm:px-6 sm:py-5">{children}</main>
    </div>
  );
}
