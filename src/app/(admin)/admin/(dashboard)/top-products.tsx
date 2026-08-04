"use client";

import { useTranslations } from "next-intl";

import { DataTable } from "@/components/admin/data-table";
import type { TopProductRow } from "@/lib/data/reports";
import { formatPrice } from "@/lib/utils/currency";

/**
 * Faz 23 Adım 2 — panodaki "bugünün çok satanları" tablosu.
 *
 * Panonun tek client bileşeni; `DataTable` sıralama/filtre için client olmak
 * zorunda. 5 satırla sınırlı olduğu için filtre kapalı — arama kutusu beş
 * satırın üstünde gürültüden ibaret olurdu; sıralama açık, çünkü "adet mi
 * ciro mu" sorusu gerçek bir sorudur.
 */
export function DashboardTopProducts({
  rows,
  currency,
  empty,
}: {
  rows: TopProductRow[];
  currency: string;
  empty: string;
}) {
  const t = useTranslations("admin.dashboard.topProducts");

  return (
    <DataTable
      rows={rows}
      rowKey={(row) => row.productName}
      empty={empty}
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
