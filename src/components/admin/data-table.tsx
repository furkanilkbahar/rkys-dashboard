"use client";

import { useTranslations } from "next-intl";
import { Fragment, useDeferredValue, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * Faz 23 Adım 1 — admin panelinin tablo primitifi.
 *
 * NEDEN VAR: admin listelerinin tamamı `flex items-center justify-between`
 * satırlarıyla masaüstü için yazılmıştı. Ölçüm (scripts/responsive-audit.mjs,
 * 2026-08-04) telefonda 308px'lik kutuda 508px içerik gösterdi ve ata
 * `overflow-hidden` olduğu için taşan kısım kaydırılamıyordu bile — yani
 * "QR'ı Yenile" butonu çizilmiyordu, kullanıcı o işi telefondan YAPAMIYORDU.
 *
 * TEK DOM, İKİ DÜZEN: burada yalnızca `<table>` render edilir; `sm` altında
 * globals.css (`.data-table`) aynı işaretlemeyi etiketli karta çevirir.
 * İkinci bir mobil işaretleme yazmak aynı `data-testid`'yi iki kez basar ve
 * Playwright'ta strict-mode ihlali üretirdi.
 *
 * İŞLEVSELLİK (yalnızca `value` veren kolonlarda): kolon başlığına tıklayarak
 * sıralama, tablo üstünde metin filtresi, satır sayacı. Yeni bağımlılık yok —
 * sıralama/filtre saf `useMemo`, hesap ~n log n.
 */
export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  /**
   * Kart modunda hücrenin önüne yazılan etiket. Verilmezse `header`'ın
   * kendisi kullanılır — ama YALNIZCA string ise; ReactNode bir başlığı
   * `String()`'e sokmak "[object Object]" basardı.
   */
  label?: string;
  cell: (row: T) => ReactNode;
  /**
   * Sıralama ve aramanın kullandığı düz değer. VERİLMEZSE kolon sıralanamaz
   * ve aramaya katılmaz — çünkü `cell`'in ReactNode çıktısından güvenilir bir
   * metin türetilemez ve uydurma bir sıralama yanlış bilgi olurdu.
   */
  value?: (row: T) => string | number | null | undefined;
  align?: "start" | "end";
  /** Kart modunda satırın başlığı olur: etiketsiz, kalın, tam genişlik. */
  primary?: boolean;
  /** İşlem hücresi: etiketsiz, kart modunda tam genişlik, butonlar sarar. */
  actions?: boolean;
  /** Kart modunda bu hücre hiç çizilmez (masaüstünde bilgi, telefonda gürültü). */
  hideOnCard?: boolean;
  className?: string;
  /** `th` genişliği — masaüstünde kolonun daralmasını engeller. */
  width?: string;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

function compare(a: string | number | null | undefined, b: string | number | null | undefined): number {
  // Boş değerler her zaman sona — yönü ne olursa olsun. "—" satırlarının
  // listenin başını doldurması sıralamayı işe yaramaz hâle getiriyor.
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty || bEmpty) return aEmpty && bEmpty ? 0 : aEmpty ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  // Türkçe sıralama: "İ" ve "ı" varsayılan karşılaştırmada yanlış yere düşer.
  return String(a).localeCompare(String(b), "tr-TR", { numeric: true });
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowAttributes,
  empty,
  searchable = false,
  initialSort,
  footer,
  expandedRow,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** E2E locator sözleşmesi burada korunur (ör. `data-testid="table-row-<id>"`). */
  rowAttributes?: (row: T) => Record<string, string>;
  empty: ReactNode;
  searchable?: boolean;
  initialSort?: { key: string; dir?: "asc" | "desc" };
  footer?: ReactNode;
  /**
   * Satırın ALTINA açılan panel (alım girişi, fire, sayım gibi satır içi
   * formlar). `null` dönerse ikinci satır hiç basılmaz. Açık/kapalı durumu
   * bilerek ÇAĞIRANDA tutulur — hangi satırın hangi panelinin açık olduğu
   * sayfanın kendi meselesi, tablonun değil.
   */
  expandedRow?: (row: T) => ReactNode | null;
}) {
  const t = useTranslations("admin.table");
  const searchId = useId();
  const [sort, setSort] = useState<SortState>(
    initialSort ? { key: initialSort.key, dir: initialSort.dir ?? "asc" } : null,
  );
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const searchableColumns = useMemo(() => columns.filter((c) => c.value), [columns]);

  const visibleRows = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase("tr-TR");
    let result = rows;

    if (needle !== "") {
      result = result.filter((row) =>
        searchableColumns.some((column) => {
          const value = column.value!(row);
          return value !== null && value !== undefined && String(value).toLocaleLowerCase("tr-TR").includes(needle);
        }),
      );
    }

    if (sort) {
      const column = columns.find((c) => c.key === sort.key);
      if (column?.value) {
        // Kopya üzerinde sırala — `rows` prop'u sunucudan geliyor, mutasyon
        // React'in referans karşılaştırmasını bozar.
        result = [...result].sort((a, b) => {
          const diff = compare(column.value!(a), column.value!(b));
          return sort.dir === "asc" ? diff : -diff;
        });
      }
    }

    return result;
  }, [rows, columns, searchableColumns, deferredQuery, sort]);

  const isFiltering = deferredQuery.trim() !== "";

  function toggleSort(key: string) {
    setSort((current) =>
      current?.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {searchable && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t("filterLabel")}
            placeholder={t("filterPlaceholder")}
            className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--surface-line-strong)] bg-transparent px-2.5 text-[13px] text-[var(--surface-fg)] placeholder:text-[var(--surface-fg-faint)] sm:max-w-64"
          />
          <span className="shrink-0 text-[12px] tabular-nums text-[var(--surface-fg-faint)]">
            {isFiltering ? t("countFiltered", { shown: visibleRows.length, total: rows.length }) : t("count", { total: rows.length })}
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--surface-fg-muted)]">{empty}</p>
      ) : (
        <>
          <table className="data-table text-[13px]">
            <thead>
              <tr>
                {columns.map((column) => {
                  const sortable = Boolean(column.value);
                  const active = sort?.key === column.key;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      style={column.width ? { width: column.width } : undefined}
                      aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                      className={`px-2 py-1.5 text-[11.5px] tracking-wide uppercase ${
                        column.align === "end" ? "text-right" : ""
                      }`}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          className="inline-flex items-center gap-1 uppercase hover:text-[var(--surface-fg)]"
                        >
                          {column.header}
                          <span aria-hidden="true" className={active ? "" : "opacity-30"}>
                            {active && sort!.dir === "desc" ? "▼" : "▲"}
                          </span>
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const expansion = expandedRow?.(row) ?? null;
                return (
                  <Fragment key={rowKey(row)}>
                <tr {...(rowAttributes?.(row) ?? {})}>
                  {columns.map((column) => {
                    // `data-label` kart modunda `::before` ile yazılır. Birincil
                    // ve işlem hücrelerinde etiket İSTEMİYORUZ, o yüzden hiç
                    // basılmıyor (boş string bassaydık grid'de boş kolon kalırdı).
                    const label =
                      column.primary || column.actions
                        ? undefined
                        : (column.label ?? (typeof column.header === "string" ? column.header : undefined));
                    return (
                      <td
                        key={column.key}
                        data-label={label}
                        data-primary={column.primary ? "" : undefined}
                        data-actions={column.actions ? "" : undefined}
                        className={`px-2 py-1.5 align-middle ${column.align === "end" ? "sm:text-right" : ""} ${
                          column.hideOnCard ? "max-sm:hidden" : ""
                        } ${column.className ?? ""}`}
                      >
                        {column.cell(row)}
                      </td>
                    );
                  })}
                    </tr>

                    {expansion && (
                      <tr data-expansion="">
                        {/* `data-actions` kart modunda etiketsiz/tam genişlik
                            demek — açılan panel için de doğru davranış. */}
                        <td colSpan={columns.length} data-actions="" className="px-2 pb-2">
                          {expansion}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {isFiltering && visibleRows.length === 0 && (
            <p className="rounded-[var(--radius)] border border-dashed border-[var(--surface-line-strong)] px-4 py-6 text-center text-[13px] text-[var(--surface-fg-muted)]">
              {t("noMatch", { query: deferredQuery })}
            </p>
          )}
        </>
      )}

      {footer}
    </div>
  );
}

/**
 * Tablo hücresi içindeki işlem butonu kümesi. Masaüstünde sağa yaslı tek
 * satır, kart modunda sola yaslı ve sarar (`.data-table td[data-actions]`).
 */
export function DataTableActions({ children }: { children: ReactNode }) {
  // Hizalama Tailwind ile yapılıyor, CSS'teki `.data-table` bloğuyla DEĞİL:
  // Tailwind v4 yardımcı sınıfları `@layer utilities`'te, bizim blok
  // `@layer components`'te — utilities her zaman kazanır, oradaki bir
  // `justify-content` kuralı sessizce etkisiz kalırdı.
  return <div className="flex flex-wrap items-center justify-start gap-1.5 sm:justify-end">{children}</div>;
}
