"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  approveOrder,
  acknowledgeCall,
  logoutWaiter,
  refetchWaiterPanel,
  type MoveTableResult,
  type WaiterPaymentNotice,
} from "@/app/(waiter)/waiter/actions";
import { assignCourier, type CourierActionResult } from "@/app/(waiter)/waiter/courier-actions";
import { OpsBadge, OpsBoard, OpsCard, OpsColumn } from "@/components/ops/ops-board";
import { OpsConnection, OpsRow, OpsSection, OpsShell } from "@/components/ops/ops-shell";
import { agingTone, elapsedMinutes, useNowMs } from "@/components/ops/use-elapsed";
import { Button } from "@/components/ui/button";
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
  const nowMs = useNowMs();
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

  async function handleLogout() {
    await logoutWaiter();
    router.push("/waiter/login");
    router.refresh();
  }

  return (
    <OpsShell
      title={t("title")}
      status={<OpsConnection connected={isConnected} connectedLabel={t("connected")} disconnectedLabel={t("disconnected")} />}
      actions={
        <>
          {!unlocked && (
            <Button type="button" variant="outline" onClick={unlock}>
              {t("enableSound")}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={handleLogout}>
            {t("logout")}
          </Button>
        </>
      }
    >
      {/* Ödeme bildirimi geçici ve dikkat isteyen bir olay — panonun üstünde,
          tam genişlikte durur ve garson kapatana kadar kaybolmaz. */}
      {paymentNotices.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {paymentNotices.map((notice) => (
            <div
              key={notice.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--r-sm)] border border-[var(--surface-line)] bg-[var(--surface-panel)] px-3 py-2"
              style={{ borderInlineStartWidth: 3, borderInlineStartColor: "var(--sem-ok)" }}
            >
              <span className="text-[15px] font-medium">
                {t("paymentReceived", { table: notice.tableLabel, method: t(`paymentMethods.${notice.method}`) })}
              </span>
              <Button type="button" variant="ghost" onClick={() => dismissPaymentNotice(notice.id)}>
                {t("dismiss")}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* İki kolonlu pano: solda garsonun ŞİMDİ yapması gereken iş (çağrılar),
          sağda onay bekleyenler. Kolon başlığındaki sayaç, tablete bakmadan
          da yükü gösterir. */}
      <OpsBoard columns={2}>
        <OpsColumn
          label={t("openCalls")}
          count={calls.length}
          tone={calls.length > 0 ? "err" : "neutral"}
          emptyLabel={t("noOpenCalls")}
        >
          {calls.map((call) => {
            const minutes = elapsedMinutes(call.createdAt, nowMs);
            return (
              // Çağrı kartı TEK SATIR: garson tabletine baktığında bir ekranda
              // olabildiğince çok çağrı görmeli. Aksiyon satırın sağında —
              // kolon KDS'ninkinden geniş, tam genişlik buton yer israfı.
              <OpsCard key={call.id} tone="err">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                  <h3 className="text-[17px] leading-tight font-bold text-[var(--surface-fg)]">{call.tableLabel}</h3>
                  <span className="text-[15px] text-[var(--surface-fg-muted)]">
                    {call.callTypeName ?? t("untypedCall")}
                  </span>
                  {minutes !== null && <OpsBadge tone={agingTone(minutes)}>{t("elapsed", { minutes })}</OpsBadge>}
                  <Button
                    type="button"
                    className="ml-auto min-w-[8.5rem] text-[14px] font-semibold"
                    onClick={() => handleAcknowledge(call.id)}
                  >
                    {t("acknowledge")}
                  </Button>
                </div>
                {call.note && <p className="px-3 pb-2.5 text-[14px] text-[var(--surface-fg-muted)]">{call.note}</p>}
              </OpsCard>
            );
          })}
        </OpsColumn>

        <OpsColumn
          label={t("pendingApproval")}
          count={pendingOrders.length}
          tone={pendingOrders.length > 0 ? "accent" : "neutral"}
          emptyLabel={t("noPendingOrders")}
        >
          {pendingOrders.map((order) => {
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
                  <span className="min-h-[22px] shrink-0">
                    {minutes !== null && <OpsBadge tone={agingTone(minutes)}>{t("elapsed", { minutes })}</OpsBadge>}
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
                        {item.variantName && <span className="text-[var(--surface-fg-muted)]"> ({item.variantName})</span>}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex px-2.5 pb-2.5">
                  <Button
                    type="button"
                    className="ml-auto min-w-[9rem] text-[14px] font-semibold"
                    onClick={() => handleApprove(order.id)}
                  >
                    {t("approve")}
                  </Button>
                </div>
              </OpsCard>
            );
          })}
        </OpsColumn>
      </OpsBoard>

      {reservations.length > 0 && (
        <OpsSection title={t("upcomingReservations")}>
          {reservations.map((reservation) => (
            <OpsRow key={reservation.id}>
              <span className="text-[15px]">
                <span className="font-semibold">{reservation.customerName}</span> ·{" "}
                {t("reservationPartySize", { count: reservation.partySize })}
                {reservation.tableLabel && <> · {reservation.tableLabel}</>}
                {" · "}
                {new Date(reservation.reservedAt).toLocaleString("tr-TR")}
              </span>
              {reservation.status === "confirmed" && (
                <Button type="button" onClick={() => handleSeatReservation(reservation.id)}>
                  {t("seatReservation")}
                </Button>
              )}
            </OpsRow>
          ))}
        </OpsSection>
      )}

      {occupiedTables.length > 0 && moveTableSession && (
        <OpsSection title={t("tableMove")}>
          {occupiedTables.map((table) => (
            // DİKKAT (§5): `table-move.spec.ts` masa etiketini bulup
            // `.locator("..")` ile ÜST öğeye çıkıyor ve seçiciyi orada arıyor
            // — etiket ile seçici arasına sarmalayıcı eklenemez.
            <OpsRow key={table.tableSessionId}>
              <span className="text-[15px] font-semibold">{table.tableLabel}</span>
              <TableMovePicker
                tableSessionId={table.tableSessionId}
                freeTables={freeTables}
                moveTableSession={moveTableSession}
                label={t("tableMoveTo")}
                onMoved={() => router.refresh()}
              />
            </OpsRow>
          ))}
        </OpsSection>
      )}

      {couriers.length > 0 && (
        <OpsSection title={t("courierAssignment")}>
          {courierLocations.length > 0 && (
            <CourierMap
              points={courierLocations.map((loc): CourierMapPoint => {
                const courier = couriers.find((c) => c.id === loc.courierId);
                return {
                  courierId: loc.courierId,
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                  label: courier?.badgeNo ?? loc.courierId.slice(0, 8),
                };
              })}
            />
          )}
          {deliveryOrders.length === 0 && (
            <p className="rounded-[var(--r-sm)] border border-dashed border-[var(--surface-line)] px-3 py-5 text-center text-[13px] text-[var(--surface-fg-faint)]">
              {t("noDeliveryOrders")}
            </p>
          )}
          {deliveryOrders.map((order) => (
            <OpsRow key={order.id}>
              <div className="flex min-w-0 flex-col">
                <span className="text-[15px]">{order.addressSnapshot ?? "—"}</span>
                <span className="text-[13px] tabular-nums text-[var(--surface-fg-muted)]">
                  {formatPrice(order.subtotalMinor, currency)}
                </span>
              </div>
              <CourierPicker
                orderId={order.id}
                couriers={couriers}
                currentCourierId={order.assignment?.courierId ?? null}
                label={t("assign")}
              />
            </OpsRow>
          ))}
        </OpsSection>
      )}
    </OpsShell>
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
