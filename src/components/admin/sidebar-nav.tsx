"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useMemo, useState } from "react";

import type { ModuleKey } from "@/lib/modules/keys";
import { cn } from "@/lib/utils/cn";

import { ADMIN_NAV_ITEMS, NAV_GROUPS } from "./nav-items";

/**
 * Faz 21 (§2.3) — 21 nav maddesini taşıyabilen navigasyon.
 *
 * Referanstaki 5 maddelik sidebar bu ürüne ölçeklenmiyor, o yüzden:
 * anlam grupları + arama. Modül filtreleme mantığı DEĞİŞMEDİ — `enabledModules`
 * filtresi aynen `nav-items.ts`'ten geliyor, yeniden yazılmadı (RULES #34:
 * kapalı modül navigasyonda görünmez; server tarafı engelleme ayrıca duruyor).
 */
export function SidebarNav({
  onNavigate,
  enabledModules = [],
}: {
  onNavigate?: () => void;
  enabledModules?: ModuleKey[];
}) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const searchId = useId();

  const visibleItems = useMemo(
    () => ADMIN_NAV_ITEMS.filter((item) => item.moduleKey === null || enabledModules.includes(item.moduleKey)),
    [enabledModules],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return visibleItems;
    return visibleItems.filter((item) => t(item.labelKey).toLocaleLowerCase("tr-TR").includes(needle));
  }, [query, visibleItems, t]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--surface-line)] bg-[var(--surface-panel)] px-2.5">
          <Search className="size-3.5 shrink-0 text-[var(--surface-fg-faint)]" aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="min-h-9 w-full bg-transparent py-1 text-xs text-[var(--surface-fg)] outline-none placeholder:text-[var(--surface-fg-faint)]"
          />
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-3" aria-label={t("dashboard")}>
        {query.trim() && filtered.length === 0 && (
          <p className="px-4 py-3 text-xs text-[var(--surface-fg-faint)]">{t("searchEmpty")}</p>
        )}

        {NAV_GROUPS.map((group) => {
          const items = filtered.filter((item) => item.group === group);
          if (items.length === 0) return null;

          return (
            <div key={group}>
              {/* Arama sırasında grup başlıkları gürültü yapmasın. */}
              {!query.trim() && (
                <h3 className="px-4 pt-3.5 pb-1 text-[10px] font-semibold tracking-[0.13em] text-[var(--surface-fg-faint)] uppercase">
                  {t(`groups.${group}`)}
                </h3>
              )}
              {items.map(({ href, labelKey, icon: Icon, exact }) => {
                const isActive = exact ? pathname === href : pathname.startsWith(href);

                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 border-l-2 px-4 py-1.5 text-[12.5px] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
                      isActive
                        ? "border-[var(--surface-accent)] bg-[var(--surface-accent-soft)] font-semibold text-[var(--surface-fg)]"
                        : "border-transparent text-[var(--surface-fg-muted)] hover:text-[var(--surface-fg)]",
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
    </div>
  );
}
