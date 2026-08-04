"use client";

import { useTranslations } from "next-intl";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

export type MenuSearchItem = {
  productId: string;
  categoryId: string;
  /** Ad + açıklama + kategori adı, aramada birlikte taranır. */
  text: string;
  soldOut: boolean;
};

/**
 * Faz 22 — menü içi arama + "yalnızca stokta olanlar" filtresi.
 *
 * Neden gerekliydi: kategori şeridi 6 kategoriye kadar iyi çalışıyor, ama
 * gerçek bir menüde 40-60 ürün oluyor ve müşteri aklındaki şeyi aramak
 * istiyor. Kategori kategori gezmek tek yol olmamalı.
 *
 * MİMARİ: arama SUNUCUYA GİTMEZ ve ürün kartlarını client'a taşımaz.
 * Kartlar Server Component olarak zaten sayfada; bu bileşen yalnızca
 * hangilerinin görüneceğine karar verir.
 *   - eşleşme hesabı SAF (render sırasında, veriden),
 *   - DOM'a dokunmak TEK yan etki olarak `useEffect` içinde.
 * Böylece hem `react-hooks` kuralları ihlal edilmez hem de misafirin
 * bağlantısı kötüyken bile arama anında çalışır (D89a JS bütçesi: bu
 * bileşen dışında hiçbir şey eklenmez).
 *
 * `useDeferredValue`: her tuş vuruşunda tüm listeyi gezmek INP bütçesini
 * zorluyordu; yazma akıcı kalsın diye filtreleme ertelenir.
 */
export function MenuSearch({ items }: { items: MenuSearchItem[] }) {
  const t = useTranslations("menu.search");
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const { visibleProductIds, visibleCategoryIds } = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase("tr-TR");
    const products = new Set<string>();
    const categories = new Set<string>();

    for (const item of items) {
      const matches =
        (needle === "" || item.text.toLocaleLowerCase("tr-TR").includes(needle)) &&
        (!availableOnly || !item.soldOut);
      if (matches) {
        products.add(item.productId);
        categories.add(item.categoryId);
      }
    }
    return { visibleProductIds: products, visibleCategoryIds: categories };
  }, [items, deferredQuery, availableOnly]);

  const isFiltering = deferredQuery.trim() !== "" || availableOnly;

  useEffect(() => {
    for (const card of document.querySelectorAll<HTMLElement>("[data-product-id]")) {
      card.hidden = isFiltering && !visibleProductIds.has(card.dataset.productId ?? "");
    }
    // Tamamı gizlenen kategorinin başlığı da gizlenir — "Tatlılar" başlığının
    // altında hiçbir şey olmaması kafa karıştırıcı olurdu.
    for (const section of document.querySelectorAll<HTMLElement>("[data-category-id]")) {
      section.hidden = isFiltering && !visibleCategoryIds.has(section.dataset.categoryId ?? "");
    }
  }, [isFiltering, visibleProductIds, visibleCategoryIds]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("label")}
            placeholder={t("placeholder")}
            className="min-h-11 w-full rounded-full border border-[var(--line)] bg-[var(--card)] pr-10 pl-4 text-[15px] text-[var(--fg)] placeholder:text-[var(--fg-faint)]"
          />
          {query !== "" && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("clear")}
              className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-lg leading-none text-[var(--fg-muted)]"
            >
              ×
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setAvailableOnly((v) => !v)}
          aria-pressed={availableOnly}
          className={`min-h-11 shrink-0 rounded-full border px-3.5 text-[13px] whitespace-nowrap transition-colors duration-[var(--dur-fast)] ${
            availableOnly
              ? "border-transparent bg-[var(--accent)] font-semibold text-[var(--accent-fg)]"
              : "border-[var(--line)] bg-[var(--card)] text-[var(--fg-muted)]"
          }`}
        >
          {t("availableOnly")}
        </button>
      </div>

      {isFiltering && (
        <p role="status" aria-live="polite" className="px-1 text-[12.5px] text-[var(--fg-faint)]">
          {visibleProductIds.size > 0
            ? t("resultCount", { count: visibleProductIds.size })
            : t("noResults", { query: deferredQuery })}
        </p>
      )}

      {isFiltering && visibleProductIds.size === 0 && (
        <p className="rounded-[var(--radius)] border border-dashed border-[var(--line)] px-4 py-8 text-center text-[14px] text-[var(--fg-muted)]">
          {t("noResultsHint")}
        </p>
      )}
    </div>
  );
}
