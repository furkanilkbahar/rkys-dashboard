"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
      <h1 className="text-xl font-semibold">{t("pageTitle")}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("syncableTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {syncableOrders.length === 0 && <p className="text-sm text-muted-foreground">{t("syncableEmpty")}</p>}
          {syncableOrders.map((order) => (
            <div key={order.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <span>
                <span className="font-medium">{formatPrice(order.subtotalMinor, currency)}</span>
                {" · "}
                <span className="text-xs text-muted-foreground">{order.channel}</span>
              </span>
              <Button type="button" size="sm" disabled={pendingId === order.id} onClick={() => handleSync(order.id)}>
                {t("send")}
              </Button>
            </div>
          ))}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("logTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {syncLog.length === 0 && <p className="text-sm text-muted-foreground">{t("logEmpty")}</p>}
          {syncLog.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{entry.status === "success" ? t("statusSuccess", { ref: entry.externalRef ?? "" }) : t("statusFailed", { message: entry.errorMessage ?? "" })}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
