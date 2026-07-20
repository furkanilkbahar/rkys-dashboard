"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { callWaiter } from "@/app/(menu)/masa/waiter-call-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SessionOrder } from "@/lib/data/sessionOrders";
import type { OrderStatus } from "@/lib/orders/stateMachine";
import { playBeep, useSoundUnlock } from "@/lib/sound/insistentAlert";
import { createClient } from "@/lib/supabase/client";

function formatPrice(priceMinor: number): string {
  return (priceMinor / 100).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
}

export function SessionPanel({
  tableSessionId,
  initialOrders,
}: {
  tableSessionId: string;
  initialOrders: SessionOrder[];
}) {
  const t = useTranslations("menu.sessionPanel");
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState(initialOrders);
  const [readyToast, setReadyToast] = useState(false);
  const [checkRequested, setCheckRequested] = useState(false);
  const { unlocked, unlock } = useSoundUnlock();
  const unlockedRef = useRef(unlocked);
  useEffect(() => {
    unlockedRef.current = unlocked;
  }, [unlocked]);
  const previousStatuses = useRef(new Map(initialOrders.map((o) => [o.id, o.status])));
  const originalTitleRef = useRef<string | null>(null);
  // Realtime event + polling fallback aynı anda tetiklenebilir; ağ
  // gecikmesiyle yanıtlar sıra dışı dönebilir. Yalnızca EN SON başlatılan
  // isteğin sonucu state'e yazılır, eski bir yanıt taze veriyi ezmez.
  const latestRequestId = useRef(0);

  const subtotalMinor = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + o.subtotalMinor, 0);

  useEffect(() => {
    const supabase = createClient();

    async function refetch() {
      const requestId = ++latestRequestId.current;

      const { data } = await supabase
        .from("orders")
        .select(
          `id, status, created_at, subtotal_minor,
           table_session_devices(device_label),
           order_items(product_name_snapshot, variant_name_snapshot, quantity, line_subtotal_minor)`,
        )
        .eq("table_session_id", tableSessionId)
        .order("created_at");

      if (requestId !== latestRequestId.current) {
        return; // daha yeni bir istek başladı, bu yanıt eskidi — atla
      }

      const nextOrders: SessionOrder[] = (data ?? []).map((order) => ({
        id: order.id,
        status: order.status as OrderStatus,
        deviceLabel: order.table_session_devices?.device_label ?? "?",
        createdAt: order.created_at,
        subtotalMinor: order.subtotal_minor,
        items: order.order_items.map((item) => ({
          name: item.product_name_snapshot,
          variantName: item.variant_name_snapshot,
          quantity: item.quantity,
          lineSubtotalMinor: item.line_subtotal_minor,
        })),
      }));

      // D33: hazır bildirimi — daha önce ready olmayan bir sipariş şimdi
      // ready olduysa ses + titreşim + toast.
      const becameReady = nextOrders.some(
        (o) => o.status === "ready" && previousStatuses.current.get(o.id) !== "ready",
      );
      if (becameReady) {
        if (unlockedRef.current) playBeep();
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        setReadyToast(true);
        setTimeout(() => setReadyToast(false), 6000);

        // D33 "sekme uyarısı": arka plandaki sekmede başlık değişir.
        if (document.hidden) {
          originalTitleRef.current ??= document.title;
          document.title = `🔔 ${t("orderReady")}`;
          const restore = () => {
            if (originalTitleRef.current) {
              document.title = originalTitleRef.current;
              originalTitleRef.current = null;
            }
            document.removeEventListener("visibilitychange", restore);
          };
          document.addEventListener("visibilitychange", restore);
        }
      }
      previousStatuses.current = new Map(nextOrders.map((o) => [o.id, o.status]));
      setOrders(nextOrders);
    }

    const channel = supabase
      .channel(`session-${tableSessionId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `table_session_id=eq.${tableSessionId}` },
        () => {
          void refetch();
        },
      )
      .subscribe((status) => {
        // Abonelik tamamlandığı an bir "yakala" fetch'i yapılır: kanalın
        // WebSocket handshake'i tamamlanmadan hemen önce/sırasında oluşan
        // bir sipariş, postgres_changes event'ini kaçırabilir (Realtime yalnız
        // abonelik SONRASI değişiklikleri iter) — bu yarışı bu fetch kapatır.
        if (status === "SUBSCRIBED") {
          void refetch();
        }
      });

    // D30 dayanıklılık: Realtime tek başına güvenceli değildir (WiFi
    // kopması, kanal yeniden bağlanması, kaçırılan event) — kısa aralıklı
    // yoklama, misafirin oturumunun er ya da geç doğru duruma yakınsamasını
    // garanti eden bir güvenlik ağıdır.
    const pollId = setInterval(() => void refetch(), 5000);

    return () => {
      clearInterval(pollId);
      void supabase.removeChannel(channel);
    };
  }, [tableSessionId, t]);

  async function handleRequestCheck() {
    const result = await callWaiter({ callTypeKey: "check" });
    if (result.ok) {
      setCheckRequested(true);
    }
  }

  return (
    <div className="relative">
      {readyToast && (
        <div className="fixed top-4 left-1/2 z-30 -translate-x-1/2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg">
          {t("orderReady")}
        </div>
      )}
      {!unlocked && (
        <button
          type="button"
          onClick={unlock}
          className="fixed top-4 right-4 z-20 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
        >
          {t("enableSound")}
        </button>
      )}

      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
        {t("toggle")}
      </Button>

      {open && (
        <div
          data-testid="session-orders-panel"
          className="absolute top-full right-0 z-30 mt-2 flex max-h-[70vh] w-80 flex-col gap-3 overflow-y-auto rounded-md border border-border bg-background p-3 shadow-lg"
        >
          {orders.length === 0 && <p className="text-sm text-muted-foreground">{t("noOrders")}</p>}
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{order.deviceLabel}</span>
                  <Badge variant={order.status === "cancelled" ? "destructive" : "secondary"}>
                    {t(`status.${order.status}`)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span>
                      {item.quantity}× {item.name}
                      {item.variantName ? ` (${item.variantName})` : ""}
                    </span>
                    <span>{formatPrice(item.lineSubtotalMinor)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <div className="flex items-center justify-between border-t border-border pt-3">
            <p className="text-sm font-semibold">{t("subtotal", { amount: formatPrice(subtotalMinor) })}</p>
            <Button type="button" size="sm" disabled={checkRequested} onClick={handleRequestCheck}>
              {checkRequested ? t("checkRequested") : t("requestCheck")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
