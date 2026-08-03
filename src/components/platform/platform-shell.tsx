"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ModeToggle } from "@/components/admin/mode-toggle";
import { cn } from "@/lib/utils/cn";
import type { Mode } from "@/themes/mode";

import { PLATFORM_NAV_GROUPS, PLATFORM_NAV_ITEMS } from "./nav-items";

/**
 * Faz 21 (§2.3) — platform chrome'u. `(admin)` ile AYNI dili konuşur:
 * iki kolon, düz, nötr, çift modlu, yükseklik dolgu açıklığıyla.
 *
 * Admin'in `AdminShell`'i modül filtreleme ve tenant/duyuru bağlamı taşıdığı
 * için ayrı bileşen; ama token'lar, yoğunluk ve nav deseni ortak.
 */
export function PlatformShell({
  title,
  mode,
  logout,
  children,
}: {
  title: string;
  mode: Mode;
  /** PlatformLogoutButton — sunucudan geçilir, shell onu yalnızca konumlandırır. */
  logout: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("platform.nav");
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-bg)] text-[var(--surface-fg)] lg:flex-row">
      <aside className="shrink-0 border-b border-[var(--surface-line)] bg-[var(--surface-sunken)] py-2.5 lg:w-[194px] lg:border-r lg:border-b-0">
        <div className="flex items-center gap-2 px-3.5 pt-1 pb-2.5 text-[12.5px] font-semibold">
          <span aria-hidden="true" className="size-[17px] shrink-0 rounded-[5px] bg-[var(--surface-accent)]" />
          {title}
        </div>

        {/* Dar ekranda yatay kaydırılabilir şerit, geniş ekranda dikey gruplu liste. */}
        <nav
          aria-label={title}
          className="flex gap-1 overflow-x-auto px-2 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0"
        >
          {PLATFORM_NAV_GROUPS.map((group) => {
            const items = PLATFORM_NAV_ITEMS.filter((item) => item.group === group);
            return (
              <div key={group} className="flex gap-1 lg:flex-col lg:gap-0">
                <h3 className="hidden px-4 pt-3.5 pb-1 text-[10px] font-semibold tracking-[0.13em] text-[var(--surface-fg-faint)] uppercase lg:block">
                  {t(`groups.${group}`)}
                </h3>
                {items.map(({ href, labelKey, icon: Icon, exact }) => {
                  const isActive = exact ? pathname === href : pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex shrink-0 items-center gap-2.5 rounded-[var(--radius)] px-3 py-1.5 text-[12.5px] whitespace-nowrap transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
                        "lg:rounded-none lg:border-l-2 lg:px-4",
                        isActive
                          ? "bg-[var(--surface-accent-soft)] font-semibold text-[var(--surface-fg)] lg:border-[var(--surface-accent)]"
                          : "text-[var(--surface-fg-muted)] hover:text-[var(--surface-fg)] lg:border-transparent",
                      )}
                    >
                      <Icon className="size-3.5 shrink-0 opacity-85" aria-hidden="true" />
                      {t(labelKey)}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[42px] items-center gap-2.5 border-b border-[var(--surface-line)] bg-[var(--surface-bg)] px-[var(--pad-panel)]">
          <span className="ml-auto" />
          <ModeToggle mode={mode} />
          {logout}
        </header>
        <main className="flex-1 p-[var(--pad-panel)]">{children}</main>
      </div>
    </div>
  );
}
