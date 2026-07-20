"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { advanceOrder } from "@/app/(kitchen)/kitchen/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StaffOrderView } from "@/lib/data/staffOrders";
import { useConnectivity, type ChannelState } from "@/lib/realtime/useConnectivity";
import { createClient } from "@/lib/supabase/client";

const NEXT_STATUS: Record<string, "preparing" | "ready" | "served" | undefined> = {
  approved: "preparing",
  preparing: "ready",
  ready: "served",
};

export function KdsPanel({
  tenantId,
  branchId,
  initialOrders,
}: {
  tenantId: string;
  branchId: string;
  initialOrders: StaffOrderView[];
}) {
  const t = useTranslations("kitchen");
  const [orders, setOrders] = useState(initialOrders);
  const [channelState, setChannelState] = useState<ChannelState>("connecting");
  const isConnected = useConnectivity(channelState);

  useEffect(() => {
    const supabase = createClient();
    // bkz. waiter-panel.tsx — Strict Mode'un çift mount'unda kanal adı
    // çakışmasın diye benzersiz suffix.
    const channel = supabase
      .channel(`kds-${branchId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` },
        () => {
          window.location.reload();
        },
      )
      .subscribe((status) => {
        setChannelState(status === "SUBSCRIBED" ? "connected" : status === "CLOSED" ? "disconnected" : "connecting");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId, branchId]);

  async function handleAdvance(id: string, toStatus: string) {
    const result = await advanceOrder({ id, toStatus });
    if (result.ok) {
      setOrders((prev) => (toStatus === "served" ? prev.filter((o) => o.id !== id) : prev.map((o) => (o.id === id ? { ...o, status: toStatus as StaffOrderView["status"] } : o))));
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <span className={isConnected ? "text-xs text-primary" : "text-xs text-destructive"}>
          {isConnected ? t("connected") : t("disconnected")}
        </span>
      </header>

      {orders.length === 0 && <p className="text-sm text-muted-foreground">{t("noOrders")}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((order) => {
          const nextStatus = NEXT_STATUS[order.status];
          return (
            <Card key={order.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{order.tableLabel}</span>
                  <span className="text-xs text-muted-foreground">{t(`status.${order.status}`)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <ul className="text-sm text-muted-foreground">
                  {order.items.map((item, index) => (
                    <li key={index}>
                      {item.quantity}× {item.name}
                      {item.variantName ? ` (${item.variantName})` : ""}
                    </li>
                  ))}
                </ul>
                {nextStatus && (
                  <Button type="button" size="sm" onClick={() => handleAdvance(order.id, nextStatus)}>
                    {t(`advanceTo.${nextStatus}`)}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
