"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { advanceOrder } from "@/app/(kitchen)/kitchen/actions";
import { OpsBadge, OpsBoard, OpsCard, OpsColumn, type OpsTone } from "@/components/ops/ops-board";
import { OpsConnection, OpsShell } from "@/components/ops/ops-shell";
import { agingTone, elapsedMinutes, useNowMs } from "@/components/ops/use-elapsed";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StaffOrderView } from "@/lib/data/staffOrders";
import { useConnectivity, type ChannelState } from "@/lib/realtime/useConnectivity";
import { createClient } from "@/lib/supabase/client";

const ALL_STATIONS = "__all__";

/**
 * Faz 21 Adım 3 — sipariş durum makinesi KOLON olarak.
 *
 * Eskiden fişler tek düz ızgaradaydı; hangi fişin hangi aşamada olduğunu
 * anlamak için her kartın köşesindeki küçük durum metnini okumak
 * gerekiyordu. Kanban aynı bilgiyi konumla verir: fiş soldan sağa ilerler,
 * kolonun yüksekliği o aşamadaki yükü uzaktan gösterir.
 */
const COLUMNS = [
  { status: "approved", next: "preparing", tone: "accent" },
  { status: "preparing", next: "ready", tone: "warn" },
  { status: "ready", next: "served", tone: "ok" },
] as const satisfies readonly { status: StaffOrderView["status"]; next: string; tone: OpsTone }[];

export function KdsPanel({
  tenantId,
  branchId,
  initialOrders,
  stations,
  selectedStation,
}: {
  tenantId: string;
  branchId: string;
  initialOrders: StaffOrderView[];
  stations: string[];
  selectedStation: string;
}) {
  const t = useTranslations("kitchen");
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [channelState, setChannelState] = useState<ChannelState>("connecting");
  const isConnected = useConnectivity(channelState);
  const nowMs = useNowMs();

  function handleStationChange(value: string | null) {
    router.push(!value || value === ALL_STATIONS ? "/kitchen" : `/kitchen?station=${encodeURIComponent(value)}`);
  }

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
      setOrders((prev) =>
        toStatus === "served"
          ? prev.filter((o) => o.id !== id)
          : prev.map((o) => (o.id === id ? { ...o, status: toStatus as StaffOrderView["status"] } : o)),
      );
    }
  }

  return (
    <OpsShell
      title={t("title")}
      status={<OpsConnection connected={isConnected} connectedLabel={t("connected")} disconnectedLabel={t("disconnected")} />}
      actions={
        stations.length > 0 && (
          <Select value={selectedStation === "" ? ALL_STATIONS : selectedStation} onValueChange={handleStationChange}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATIONS}>{t("allStations")}</SelectItem>
              {stations.map((station) => (
                <SelectItem key={station} value={station}>
                  {station}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }
    >
      {orders.length === 0 ? (
        <p className="rounded-[var(--r-md)] border border-dashed border-[var(--surface-line)] px-4 py-16 text-center text-[15px] text-[var(--surface-fg-muted)]">
          {t("noOrders")}
        </p>
      ) : (
        <OpsBoard columns={3}>
          {COLUMNS.map((column) => {
            const columnOrders = orders.filter((order) => order.status === column.status);
            return (
              <OpsColumn
                key={column.status}
                label={t(`status.${column.status}`)}
                count={columnOrders.length}
                tone={column.tone}
                emptyLabel={t("columnEmpty")}
              >
                {columnOrders.map((order) => {
                  const minutes = elapsedMinutes(order.createdAt, nowMs);
                  return (
                    <OpsCard key={order.id} tone={agingTone(minutes)}>
                      <div className="flex items-start gap-2 px-3 pt-2.5">
                        <h3 className="min-w-0 flex-1 text-[17px] leading-tight font-bold break-words text-[var(--surface-fg)]">
                          {order.tableLabel ??
                            (order.pickupCode
                              ? t("pickupLabel", { code: order.pickupCode })
                              : order.isDelivery
                                ? t("deliveryLabel")
                                : order.marketplaceProvider
                                  ? t("marketplaceLabel", { provider: order.marketplaceProvider })
                                  : "?")}
                        </h3>
                        {/* Rozet yeri hidrasyondan önce de ayrılır — süre
                            geldiğinde başlık satırı kaymaz (CLS). */}
                        <span className="min-h-[22px] shrink-0">
                          {minutes !== null && (
                            <OpsBadge tone={agingTone(minutes)}>{t("elapsed", { minutes })}</OpsBadge>
                          )}
                        </span>
                      </div>

                      <ul className="flex flex-col gap-1 px-3 py-2.5">
                        {order.items.map((item, index) => (
                          <li key={index} className="flex items-baseline gap-2 text-[15px] leading-snug">
                            <span className="min-w-[1.5rem] shrink-0 text-right font-bold tabular-nums text-[var(--surface-accent)]">
                              {item.quantity}
                            </span>
                            <span className="min-w-0 text-[var(--surface-fg)]">
                              {item.name}
                              {item.variantName && (
                                <span className="text-[var(--surface-fg-muted)]"> ({item.variantName})</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="px-2.5 pb-2.5">
                        <Button
                          type="button"
                          className="w-full text-[14px] font-semibold"
                          onClick={() => handleAdvance(order.id, column.next)}
                        >
                          {t(`advanceTo.${column.next}`)}
                        </Button>
                      </div>
                    </OpsCard>
                  );
                })}
              </OpsColumn>
            );
          })}
        </OpsBoard>
      )}
    </OpsShell>
  );
}
