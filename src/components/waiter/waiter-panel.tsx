"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { approveOrder, acknowledgeCall } from "@/app/(waiter)/waiter/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WaiterCallView } from "@/lib/data/waiterCalls";
import type { StaffOrderView } from "@/lib/data/staffOrders";
import { useConnectivity, type ChannelState } from "@/lib/realtime/useConnectivity";
import { useInsistentAlert, useSoundUnlock } from "@/lib/sound/insistentAlert";
import { createClient } from "@/lib/supabase/client";

export function WaiterPanel({
  tenantId,
  branchId,
  initialCalls,
  initialPendingOrders,
}: {
  tenantId: string;
  branchId: string;
  initialCalls: WaiterCallView[];
  initialPendingOrders: StaffOrderView[];
}) {
  const t = useTranslations("waiter");
  const [calls, setCalls] = useState(initialCalls);
  const [pendingOrders, setPendingOrders] = useState(initialPendingOrders);
  const [channelState, setChannelState] = useState<ChannelState>("connecting");
  const { unlocked, unlock } = useSoundUnlock();

  const isConnected = useConnectivity(channelState);
  useInsistentAlert(calls.length > 0, unlocked);

  useEffect(() => {
    const supabase = createClient();
    // Kanal adı her effect koşumunda benzersiz olmalı: React Strict Mode
    // (dev) mount'u iki kez tetikler; aynı topic adı paylaşılırsa ilk
    // koşumun cleanup'ı ikinci koşumun kanalını da kapatabiliyor.
    const channel = supabase
      .channel(`waiter-${branchId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waiter_calls", filter: `tenant_id=eq.${tenantId}` },
        () => {
          // Basitlik için tam yeniden fetch — Faz1 kapsamında yeterli;
          // ince taneli patch'leme (yalnız değişen satır) ileri fazda.
          window.location.reload();
        },
      )
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

  async function handleAcknowledge(id: string) {
    const result = await acknowledgeCall({ id });
    if (result.ok) {
      setCalls((prev) => prev.filter((c) => c.id !== id));
    }
  }

  async function handleApprove(id: string) {
    const result = await approveOrder({ id });
    if (result.ok) {
      setPendingOrders((prev) => prev.filter((o) => o.id !== id));
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <div className="flex items-center gap-3">
          {!unlocked && (
            <Button type="button" size="sm" variant="outline" onClick={unlock}>
              {t("enableSound")}
            </Button>
          )}
          <span className={isConnected ? "text-xs text-primary" : "text-xs text-destructive"}>
            {isConnected ? t("connected") : t("disconnected")}
          </span>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("openCalls")}</h2>
        {calls.length === 0 && <p className="text-sm text-muted-foreground">{t("noOpenCalls")}</p>}
        {calls.map((call) => (
          <Card key={call.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {call.tableLabel} — {call.callTypeName ?? t("untypedCall")}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button type="button" size="sm" onClick={() => handleAcknowledge(call.id)}>
                {t("acknowledge")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("pendingApproval")}</h2>
        {pendingOrders.length === 0 && <p className="text-sm text-muted-foreground">{t("noPendingOrders")}</p>}
        {pendingOrders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <CardTitle className="text-sm">
                {order.tableLabel ?? (order.pickupCode ? t("pickupLabel", { code: order.pickupCode }) : "?")}
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
              <Button type="button" size="sm" onClick={() => handleApprove(order.id)}>
                {t("approve")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
