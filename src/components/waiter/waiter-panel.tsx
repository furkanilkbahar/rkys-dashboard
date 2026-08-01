"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  approveOrder,
  acknowledgeCall,
  refetchWaiterPanel,
  type MoveTableResult,
  type WaiterPaymentNotice,
} from "@/app/(waiter)/waiter/actions";
import { assignCourier, type CourierActionResult } from "@/app/(waiter)/waiter/courier-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminTable } from "@/lib/data/adminTables";
import type { CourierLocationView, CourierOption, DeliveryOrderView } from "@/lib/data/courier";
import type { CourierMapPoint } from "@/components/courier/courier-map";
import type { AdminReservation } from "@/lib/data/reservations";
import type { OccupiedTable } from "@/lib/data/tableSessions";
import type { WaiterCallView } from "@/lib/data/waiterCalls";
import type { StaffOrderView } from "@/lib/data/staffOrders";
import type { ReservationActionResult } from "@/lib/reservations/schemas";
import { useConnectivity, type ChannelState } from "@/lib/realtime/useConnectivity";
import { useInsistentAlert, useSoundUnlock } from "@/lib/sound/insistentAlert";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils/currency";

// SSR sırasında leaflet window/document'e erişip patlıyor — yalnızca
// istemcide yüklenir.
const CourierMap = dynamic(() => import("@/components/courier/courier-map").then((m) => m.CourierMap), { ssr: false });

export function WaiterPanel({
  tenantId,
  branchId,
  initialCalls,
  initialPendingOrders,
  deliveryOrders = [],
  couriers = [],
  initialCourierLocations = [],
  currency = "TRY",
  upcomingReservations = [],
  seatReservation,
  occupiedTables = [],
  freeTables = [],
  moveTableSession,
}: {
  tenantId: string;
  branchId: string;
  initialCalls: WaiterCallView[];
  initialPendingOrders: StaffOrderView[];
  deliveryOrders?: DeliveryOrderView[];
  couriers?: CourierOption[];
  initialCourierLocations?: CourierLocationView[];
  currency?: string;
  upcomingReservations?: AdminReservation[];
  seatReservation?: (reservationId: string) => Promise<ReservationActionResult>;
  occupiedTables?: OccupiedTable[];
  freeTables?: AdminTable[];
  moveTableSession?: (tableSessionId: string, toTableId: string) => Promise<MoveTableResult>;
}) {
  const t = useTranslations("waiter");
  const [calls, setCalls] = useState(initialCalls);
  const [pendingOrders, setPendingOrders] = useState(initialPendingOrders);
  const [reservations, setReservations] = useState(upcomingReservations);
  const [courierLocations, setCourierLocations] = useState(initialCourierLocations);
  const [paymentNotices, setPaymentNotices] = useState<WaiterPaymentNotice[]>([]);
  const router = useRouter();
  const [channelState, setChannelState] = useState<ChannelState>("connecting");
  const { unlocked, unlock } = useSoundUnlock();

  const isConnected = useConnectivity(channelState);
  useInsistentAlert(calls.length > 0, unlocked);

  const lastPaymentCheckRef = useRef(new Date().toISOString());

  useEffect(() => {
    let cancelled = false;
    async function refetch() {
      const sincePaymentsIso = lastPaymentCheckRef.current;
      const result = await refetchWaiterPanel(sincePaymentsIso);
      if (cancelled) return;
      setCalls(result.calls);
      setPendingOrders(result.pendingOrders);
      if (result.newPayments.length > 0) {
        setPaymentNotices((prev) => [...prev, ...result.newPayments]);
      }
      lastPaymentCheckRef.current = new Date().toISOString();
    }

    const supabase = createClient();
    // Kanal adı her effect koşumunda benzersiz olmalı: React Strict Mode
    // (dev) mount'u iki kez tetikler; aynı topic adı paylaşılırsa ilk
    // koşumun cleanup'ı ikinci koşumun kanalını da kapatabiliyor.
    //
    // İKİ AYRI kanal kullanılır (waiter_calls + orders), TEK kanalda iki
    // postgres_changes filtresi birleştirilmez — Supabase Realtime'ın
    // realtime.subscription_check_filters tetikleyicisi aynı phx_join'de
    // birden fazla tablo filtresi geldiğinde ikinci filtre için "invalid
    // column for filter tenant_id" istisnası fırlatıp o kanalı tamamen
    // bozabiliyor (gözlem: kds-panel.tsx zaten tablo başına tek kanal
    // kullanıyor ve bu sorunu hiç yaşamıyor — aynı desen burada da izlenir).
    const uniqueId = crypto.randomUUID();
    const callsChannel = supabase
      .channel(`waiter-calls-${branchId}-${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waiter_calls", filter: `tenant_id=eq.${tenantId}` },
        () => void refetch(),
      )
      .subscribe((status) => {
        setChannelState(status === "SUBSCRIBED" ? "connected" : status === "CLOSED" ? "disconnected" : "connecting");
        // Abonelik tamamlandığı an bir "yakala" fetch'i: WebSocket handshake
        // tamamlanmadan hemen önce/sırasında düşen bir çağrı/sipariş,
        // postgres_changes event'ini kaçırabilir (session-panel.tsx ile
        // aynı desen).
        if (status === "SUBSCRIBED") void refetch();
      });

    const ordersChannel = supabase
      .channel(`waiter-orders-${branchId}-${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` },
        () => void refetch(),
      )
      .subscribe();

    // D30 dayanıklılık: Realtime tek başına güvenceli değildir (bkz.
    // PLAN.md Faz 19 — lokal Realtime'ın tenant_id filtreli abonelikte
    // bilinen bir sorunu var) — kısa aralıklı yoklama, açık çağrıların er ya
    // da geç doğru duruma yakınsamasını garanti eden bir güvenlik ağıdır.
    // Tam sayfa yenileme YAPILMAZ: hem garsonun akışını bozar hem de ses
    // açma tercihini (useSoundUnlock) sıfırlardı.
    const pollId = setInterval(() => void refetch(), 5000);

    // Kurye konumu sık güncellenir — bu kanal tam sayfa yenilemek yerine
    // yalnızca ilgili satırı state'te günceller (harita akıcı kalır).
    const courierLocationsChannel = supabase
      .channel(`waiter-courier-locations-${branchId}-${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "courier_locations", filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          const row = payload.new as { courier_id: string; latitude: number; longitude: number; updated_at: string } | null;
          if (!row) return;
          setCourierLocations((prev) => [
            ...prev.filter((l) => l.courierId !== row.courier_id),
            { courierId: row.courier_id, latitude: row.latitude, longitude: row.longitude, updatedAt: row.updated_at },
          ]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(pollId);
      void supabase.removeChannel(callsChannel);
      void supabase.removeChannel(ordersChannel);
      void supabase.removeChannel(courierLocationsChannel);
    };
  }, [tenantId, branchId]);

  function dismissPaymentNotice(id: string) {
    setPaymentNotices((prev) => prev.filter((n) => n.id !== id));
  }

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

  async function handleSeatReservation(id: string) {
    if (!seatReservation) return;
    const result = await seatReservation(id);
    if (result.ok) {
      setReservations((prev) => prev.filter((r) => r.id !== id));
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

      {paymentNotices.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{t("paymentNotices")}</h2>
          {paymentNotices.map((notice) => (
            <div key={notice.id} className="flex items-center justify-between gap-2 rounded-md border border-primary/50 bg-primary/5 p-2 text-sm">
              <span>{t("paymentReceived", { table: notice.tableLabel, method: t(`paymentMethods.${notice.method}`) })}</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => dismissPaymentNotice(notice.id)}>
                {t("dismiss")}
              </Button>
            </div>
          ))}
        </section>
      )}

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
                {order.tableLabel ??
                  (order.pickupCode
                    ? t("pickupLabel", { code: order.pickupCode })
                    : order.isDelivery
                      ? t("deliveryLabel")
                      : order.marketplaceProvider
                        ? t("marketplaceLabel", { provider: order.marketplaceProvider })
                        : "?")}
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

      {reservations.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{t("upcomingReservations")}</h2>
          {reservations.map((reservation) => (
            <div key={reservation.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <span>
                <span className="font-medium">{reservation.customerName}</span> · {t("reservationPartySize", { count: reservation.partySize })}
                {reservation.tableLabel && <> · {reservation.tableLabel}</>}
                {" · "}
                {new Date(reservation.reservedAt).toLocaleString("tr-TR")}
              </span>
              {reservation.status === "confirmed" && (
                <Button type="button" size="sm" onClick={() => handleSeatReservation(reservation.id)}>
                  {t("seatReservation")}
                </Button>
              )}
            </div>
          ))}
        </section>
      )}

      {occupiedTables.length > 0 && moveTableSession && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{t("tableMove")}</h2>
          {occupiedTables.map((table) => (
            <div key={table.tableSessionId} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <span className="font-medium">{table.tableLabel}</span>
              <TableMovePicker
                tableSessionId={table.tableSessionId}
                freeTables={freeTables}
                moveTableSession={moveTableSession}
                label={t("tableMoveTo")}
                onMoved={() => router.refresh()}
              />
            </div>
          ))}
        </section>
      )}

      {couriers.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{t("courierAssignment")}</h2>
          {courierLocations.length > 0 && (
            <CourierMap
              points={courierLocations.map((loc): CourierMapPoint => {
                const courier = couriers.find((c) => c.id === loc.courierId);
                return { courierId: loc.courierId, latitude: loc.latitude, longitude: loc.longitude, label: courier?.badgeNo ?? loc.courierId.slice(0, 8) };
              })}
            />
          )}
          {deliveryOrders.length === 0 && <p className="text-sm text-muted-foreground">{t("noDeliveryOrders")}</p>}
          {deliveryOrders.map((order) => (
            <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <div className="flex flex-col">
                <span>{order.addressSnapshot ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{formatPrice(order.subtotalMinor, currency)}</span>
              </div>
              <CourierPicker orderId={order.id} couriers={couriers} currentCourierId={order.assignment?.courierId ?? null} label={t("assign")} />
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

function TableMovePicker({
  tableSessionId,
  freeTables,
  moveTableSession,
  label,
  onMoved,
}: {
  tableSessionId: string;
  freeTables: AdminTable[];
  moveTableSession: (tableSessionId: string, toTableId: string) => Promise<MoveTableResult>;
  label: string;
  onMoved: () => void;
}) {
  const t = useTranslations("waiter");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(value: string | null) {
    if (!value) return;
    setPending(true);
    setError(null);
    const result = await moveTableSession(tableSessionId, value);
    setPending(false);
    if (!result.ok) {
      setError(t(`tableMoveErrors.${result.error}`));
      return;
    }
    onMoved();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Select value="" onValueChange={handleChange} disabled={pending}>
        <SelectTrigger aria-label={label} className="w-40">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {freeTables.map((table) => (
            <SelectItem key={table.id} value={table.id}>
              {table.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function CourierPicker({
  orderId,
  couriers,
  currentCourierId,
  label,
}: {
  orderId: string;
  couriers: CourierOption[];
  currentCourierId: string | null;
  label: string;
}) {
  const [courierId, setCourierId] = useState(currentCourierId ?? "");
  const [pending, setPending] = useState(false);

  async function handleChange(value: string | null) {
    if (!value) return;
    setCourierId(value);
    setPending(true);
    const result: CourierActionResult = await assignCourier(orderId, value);
    setPending(false);
    if (!result.ok) {
      setCourierId(currentCourierId ?? "");
    }
  }

  return (
    <Select value={courierId} onValueChange={handleChange} disabled={pending}>
      <SelectTrigger aria-label={label} className="w-40">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {couriers.map((courier) => (
          <SelectItem key={courier.id} value={courier.id}>
            {courier.badgeNo ?? courier.id.slice(0, 8)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
