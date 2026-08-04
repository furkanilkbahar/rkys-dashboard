"use client";

import { useTranslations } from "next-intl";

import { DataTable } from "@/components/admin/data-table";
import type {
  CampaignPerformanceRow,
  LossReportRow,
  MenuEngineeringRow,
} from "@/lib/data/periodReports";
import type { MarginRow, ShiftForDate, TopProductRow } from "@/lib/data/reports";
import { formatPrice } from "@/lib/utils/currency";

/**
 * Faz 23 Adım 3d — raporların altı listesi.
 *
 * NEDEN AYRI BİR CLIENT DOSYASI: `reports/page.tsx` bir Server Component ve
 * `DataTable`'ın kolon tanımları FONKSİYON taşıyor (`cell`, `value`) —
 * fonksiyonlar sunucu/istemci sınırından geçemez. Kolonlar bu yüzden burada,
 * istemci tarafında kuruluyor; sayfa yalnızca düz veri geçiyor.
 *
 * Bu sayfa uygulamadaki en tablo-şekilli yerdi: altı bölümün tamamı
 * `flex justify-between` ile "ad ..... değer" satırları çiziyordu. Karşılaştırma
 * yapılamıyordu (hangi ürün daha kârlı?), sıralanamıyordu, aranamıyordu.
 *
 * ORTAK KURAL: para ve süre kolonları HAM SAYI ile sıralanır. Biçimlenmiş
 * metni sıralamak "₺90 > ₺1.200,00" gibi sessiz yanlışlar üretir.
 */

export function TopProductsTable({
  rows,
  currency,
  empty,
}: {
  rows: TopProductRow[];
  currency: string;
  empty: string;
}) {
  const t = useTranslations("admin.reports.columns");

  return (
    <DataTable
      rows={rows}
      rowKey={(row) => row.productName}
      empty={empty}
      searchable
      initialSort={{ key: "revenue", dir: "desc" }}
      columns={[
        {
          key: "product",
          header: t("product"),
          primary: true,
          value: (row) => row.productName,
          cell: (row) => row.productName,
        },
        {
          key: "quantity",
          header: t("quantity"),
          align: "end",
          value: (row) => row.quantity,
          cell: (row) => <span className="tabular-nums">{row.quantity}</span>,
        },
        {
          key: "revenue",
          header: t("revenue"),
          align: "end",
          value: (row) => row.revenueMinor,
          cell: (row) => <span className="tabular-nums">{formatPrice(row.revenueMinor, currency)}</span>,
        },
      ]}
    />
  );
}

export function MarginTable({ rows, currency, empty }: { rows: MarginRow[]; currency: string; empty: string }) {
  const t = useTranslations("admin.reports.columns");

  return (
    <DataTable
      rows={rows}
      rowKey={(row) => row.productName}
      empty={empty}
      searchable
      initialSort={{ key: "margin", dir: "desc" }}
      columns={[
        {
          key: "product",
          header: t("product"),
          primary: true,
          value: (row) => row.productName,
          cell: (row) => row.productName,
        },
        {
          key: "revenue",
          header: t("revenue"),
          align: "end",
          value: (row) => row.revenueMinor,
          cell: (row) => <span className="tabular-nums">{formatPrice(row.revenueMinor, currency)}</span>,
        },
        {
          key: "cost",
          header: t("cost"),
          align: "end",
          value: (row) => row.costMinor,
          cell: (row) => <span className="tabular-nums">{formatPrice(row.costMinor, currency)}</span>,
        },
        {
          key: "margin",
          header: t("margin"),
          align: "end",
          value: (row) => row.marginMinor,
          cell: (row) => (
            <span
              className="font-medium tabular-nums"
              // Negatif marj SESSİZ KALMAMALI: bir ürünü zararına satmak
              // raporun en pahalı bulgusu, nötr griyle geçiştirilemez.
              style={{ color: row.marginMinor < 0 ? "var(--sem-err-fg)" : undefined }}
            >
              {formatPrice(row.marginMinor, currency)}
            </span>
          ),
        },
      ]}
    />
  );
}

export function ShiftsTable({
  rows,
  currency,
  empty,
  statusLabel,
}: {
  rows: ShiftForDate[];
  currency: string;
  empty: string;
  /** Durum etiketleri sunucudan geliyor — `admin.reports.status.*` sözlüğü. */
  statusLabel: Record<string, string>;
}) {
  const t = useTranslations("admin.reports");

  return (
    <DataTable
      rows={rows}
      rowKey={(row) => row.shiftId}
      empty={empty}
      columns={[
        {
          key: "status",
          header: t("columns.status"),
          primary: true,
          value: (row) => row.status,
          cell: (row) => statusLabel[row.status] ?? row.status,
        },
        {
          key: "expected",
          header: t("expected"),
          align: "end",
          value: (row) => row.expectedCashMinor,
          cell: (row) => (
            <span className="tabular-nums">
              {row.expectedCashMinor !== null ? formatPrice(row.expectedCashMinor, currency) : "—"}
            </span>
          ),
        },
        {
          key: "counted",
          header: t("counted"),
          align: "end",
          value: (row) => row.countedCashMinor,
          cell: (row) => (
            <span className="tabular-nums">
              {row.countedCashMinor !== null ? formatPrice(row.countedCashMinor, currency) : "—"}
            </span>
          ),
        },
        {
          key: "variance",
          header: t("variance"),
          align: "end",
          value: (row) => row.varianceMinor,
          cell: (row) => (
            <span
              className="font-medium tabular-nums"
              // Kasa farkı sıfırdan farklıysa işaretlenir — kasa raporunun
              // varlık sebebi tam olarak bu kolon.
              style={{
                color:
                  row.varianceMinor !== null && row.varianceMinor !== 0 ? "var(--sem-warn-fg)" : undefined,
              }}
            >
              {row.varianceMinor !== null ? formatPrice(row.varianceMinor, currency) : "—"}
            </span>
          ),
        },
      ]}
    />
  );
}

export function LossTable({
  rows,
  currency,
  empty,
  sourceLabel,
  noReasonLabel,
  countLabel,
}: {
  rows: LossReportRow[];
  currency: string;
  empty: string;
  sourceLabel: Record<string, string>;
  noReasonLabel: string;
  countLabel: string;
}) {
  const t = useTranslations("admin.reports.columns");

  return (
    <DataTable
      rows={rows}
      // Kaynak+sebep bileşimi satırın doğal anahtarı; sunucu tarafında da
      // gruplama böyle yapılıyor (bir sebep birden fazla kaynakta çıkabilir).
      rowKey={(row) => `${row.source}-${row.reasonCodeId ?? "none"}`}
      empty={empty}
      initialSort={{ key: "amount", dir: "desc" }}
      columns={[
        {
          key: "source",
          header: t("source"),
          primary: true,
          value: (row) => sourceLabel[row.source] ?? row.source,
          cell: (row) => sourceLabel[row.source] ?? row.source,
        },
        {
          key: "reason",
          header: t("reason"),
          value: (row) => row.reasonKey,
          cell: (row) => (
            <span className="text-[var(--surface-fg-muted)]">{row.reasonKey ?? noReasonLabel}</span>
          ),
        },
        {
          key: "count",
          header: countLabel,
          align: "end",
          value: (row) => row.itemCount,
          cell: (row) => <span className="tabular-nums">{row.itemCount}</span>,
        },
        {
          key: "amount",
          header: t("amount"),
          align: "end",
          value: (row) => row.amountMinor,
          cell: (row) => (
            <span className="font-medium tabular-nums">{formatPrice(row.amountMinor, currency)}</span>
          ),
        },
      ]}
    />
  );
}

export function CampaignPerformanceTable({
  rows,
  currency,
  empty,
  countLabel,
}: {
  rows: CampaignPerformanceRow[];
  currency: string;
  empty: string;
  countLabel: string;
}) {
  const t = useTranslations("admin.reports.columns");

  return (
    <DataTable
      rows={rows}
      rowKey={(row) => row.campaignId}
      empty={empty}
      initialSort={{ key: "discount", dir: "desc" }}
      columns={[
        {
          key: "campaign",
          header: t("campaign"),
          primary: true,
          value: (row) => row.campaignName,
          cell: (row) => row.campaignName,
        },
        {
          key: "count",
          header: countLabel,
          align: "end",
          value: (row) => row.redemptionCount,
          cell: (row) => <span className="tabular-nums">{row.redemptionCount}</span>,
        },
        {
          key: "discount",
          header: t("discount"),
          align: "end",
          value: (row) => row.totalDiscountMinor,
          cell: (row) => (
            <span className="font-medium tabular-nums">{formatPrice(row.totalDiscountMinor, currency)}</span>
          ),
        },
      ]}
    />
  );
}

/** D47 menü mühendisliği kategorileri → anlam token'ları (RULES #13). */
const MENU_ENGINEERING_TONE: Record<string, string> = {
  star: "var(--sem-ok)",
  plowhorse: "var(--sem-warn)",
  puzzle: "var(--sem-info)",
  dog: "var(--sem-err)",
};

export function MenuEngineeringTable({
  rows,
  currency,
  empty,
  categoryLabel,
  marginSuffix,
}: {
  rows: MenuEngineeringRow[];
  currency: string;
  empty: string;
  categoryLabel: Record<string, string>;
  marginSuffix: string;
}) {
  const t = useTranslations("admin.reports.columns");

  return (
    <DataTable
      rows={rows}
      rowKey={(row) => row.productName}
      empty={empty}
      searchable
      initialSort={{ key: "margin", dir: "desc" }}
      columns={[
        {
          key: "product",
          header: t("product"),
          primary: true,
          value: (row) => row.productName,
          cell: (row) => row.productName,
        },
        {
          key: "category",
          header: t("category"),
          value: (row) => categoryLabel[row.category] ?? row.category,
          cell: (row) => (
            <span
              className="rounded px-1.5 py-0.5 text-[11px] font-medium"
              style={{
                color: MENU_ENGINEERING_TONE[row.category],
                backgroundColor: `color-mix(in oklch, ${MENU_ENGINEERING_TONE[row.category]} 12%, transparent)`,
              }}
            >
              {categoryLabel[row.category] ?? row.category}
            </span>
          ),
        },
        {
          key: "quantity",
          header: t("quantity"),
          align: "end",
          value: (row) => row.quantity,
          cell: (row) => <span className="tabular-nums">{row.quantity}</span>,
        },
        {
          key: "margin",
          header: `${t("margin")} ${marginSuffix}`,
          align: "end",
          value: (row) => row.marginMinor,
          cell: (row) => (
            <span className="font-medium tabular-nums">{formatPrice(row.marginMinor, currency)}</span>
          ),
        },
      ]}
    />
  );
}
