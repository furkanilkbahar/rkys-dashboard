"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DataTable, DataTableActions } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccountingActionResult } from "@/lib/accounting/schemas";
import type { AccountingSyncLogEntry, SyncableOrder } from "@/lib/data/accounting";
import { formatPrice } from "@/lib/utils/currency";

export function AccountingManager({
  syncableOrders,
  syncLog,
  currency,
  syncOrderToAccounting,
}: {
  syncableOrders: SyncableOrder[];
  syncLog: AccountingSyncLogEntry[];
  currency: string;
  syncOrderToAccounting: (orderId: string) => Promise<AccountingActionResult>;
}) {
  const t = useTranslations("admin.accounting");
  const tGrid = useTranslations("admin.table");
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync(orderId: string) {
    setPendingId(orderId);
    setError(null);
    const result = await syncOrderToAccounting(orderId);
    setPendingId(null);
    if (!result.ok) {
      setError(t(`errors.${result.error}`));
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={t("pageTitle")} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("syncableTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <DataTable
            rows={syncableOrders}
            rowKey={(order) => order.id}
            empty={t("syncableEmpty")}
            initialSort={{ key: "amount", dir: "desc" }}
            columns={[
              {
                key: "amount",
                header: t("amount"),
                primary: true,
                value: (order) => order.subtotalMinor,
                cell: (order) => (
                  <span className="tabular-nums">{formatPrice(order.subtotalMinor, currency)}</span>
                ),
              },
              {
                key: "channel",
                header: t("channel"),
                value: (order) => order.channel,
                cell: (order) => <span className="text-[var(--surface-fg-muted)]">{order.channel}</span>,
              },
              {
                key: "actions",
                header: tGrid("actions"),
                actions: true,
                align: "end",
                cell: (order) => (
                  <DataTableActions>
                    <Button type="button" size="sm" disabled={pendingId === order.id} onClick={() => handleSync(order.id)}>
                      {t("send")}
                    </Button>
                  </DataTableActions>
                ),
              },
            ]}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("logTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <DataTable
            rows={syncLog}
            rowKey={(entry) => entry.id}
            empty={t("logEmpty")}
            columns={[
              {
                key: "status",
                header: tGrid("status"),
                primary: true,
                value: (entry) => entry.status,
                cell: (entry) =>
                  entry.status === "success"
                    ? t("statusSuccess", { ref: entry.externalRef ?? "" })
                    : t("statusFailed", { message: entry.errorMessage ?? "" }),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
