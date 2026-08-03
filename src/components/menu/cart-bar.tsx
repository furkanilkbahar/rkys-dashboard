"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SubmitOrderInput, SubmitOrderResult } from "@/lib/orders/schemas";
import { useCartStore } from "@/lib/store/cart";
import { formatPrice } from "@/lib/utils/currency";

export type DeliveryZoneOption = { id: string; name: string; feeMinor: number; minBasketMinor: number };

/**
 * Faz 21 Adım 0 — kalıcı alt çubuk (§2.2 kural 6).
 *
 * Yüzen, yuvarlak, yarı saydam. SEKME ÇUBUĞU DEĞİL: referanslardaki
 * Home/Map/Search/Profile alt sekme çubuğu bilinçli olarak alınmadı — RKYS
 * menüsü masaya bağlı, tek işletme, girişsiz bir menüdür. Buradaki tek iki
 * eylem sepet ve (dışarıdan geçilen) garson çağır.
 *
 * Kabul kriteri 4 (durum hareketi): sepet sayacı arttığında rozet kısa bir
 * "pop" yapar — kullanıcı ürünün gerçekten eklendiğini görür. Bu, ekleme
 * animasyonunun tek amaçlı hâli; süsleme değil.
 */
export function CartBar({
  currency,
  onSubmit,
  deliveryZones,
  trailing,
}: {
  currency: string;
  onSubmit: (input: SubmitOrderInput) => Promise<SubmitOrderResult>;
  deliveryZones?: DeliveryZoneOption[];
  /** Garson çağır gibi, çubuğun sağında duracak ikincil eylem. */
  trailing?: ReactNode;
}) {
  const t = useTranslations("menu.cart");
  const lines = useCartStore((state) => state.lines);
  const clear = useCartStore((state) => state.clear);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string>("");
  const [address, setAddress] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [bumped, setBumped] = useState(false);

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotalMinor = lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  const selectedZone = deliveryZones?.find((z) => z.id === zoneId);
  const isDelivery = deliveryZones !== undefined;
  const canSubmit = !isDelivery || (zoneId !== "" && address.trim().length > 0);

  // Sayaç arttığında tek seferlik "pop".
  const previousCount = useRef(itemCount);
  useEffect(() => {
    if (itemCount > previousCount.current) {
      setBumped(true);
      const timer = window.setTimeout(() => setBumped(false), 260);
      return () => window.clearTimeout(timer);
    }
    previousCount.current = itemCount;
  }, [itemCount]);
  useEffect(() => {
    previousCount.current = itemCount;
  }, [itemCount]);

  async function handleSubmit() {
    setStatus("submitting");
    setErrorKey(null);

    const result = await onSubmit({
      idempotencyKey: crypto.randomUUID(),
      items: lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
        extraIds: line.extraIds,
      })),
      ...(isDelivery
        ? {
            deliveryZoneId: zoneId,
            deliveryAddress: address,
            ...(scheduledFor ? { scheduledFor: new Date(scheduledFor).toISOString() } : {}),
          }
        : {}),
    });

    if (result.ok) {
      clear();
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("error");
      setErrorKey(result.error);
    }
  }

  const showCart = itemCount > 0 || status === "success";

  // Çubuk KALICIDIR: sepet boş olsa da (garson çağır için) durur. Yalnızca
  // sepet segmenti koşullu.
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-3">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {status === "success" && (
          <p className="rounded-full bg-[var(--card)] px-4 py-2 text-center text-sm text-[var(--accent)] shadow-lg">
            {t("success")}
          </p>
        )}
        {status === "error" && errorKey && (
          <p className="rounded-full bg-[var(--card)] px-4 py-2 text-center text-sm text-[var(--destructive)] shadow-lg">
            {t(errorKey)}
          </p>
        )}

        {showCart && isDelivery && itemCount > 0 && (
          <div className="flex flex-col gap-2 rounded-[var(--radius)] bg-[var(--card)]/95 p-3 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-1">
              <Label htmlFor="delivery-zone">{t("delivery.zone")}</Label>
              <Select value={zoneId} onValueChange={(v) => setZoneId(v ?? "")}>
                <SelectTrigger id="delivery-zone" aria-label={t("delivery.zone")} className="w-full">
                  <SelectValue placeholder={t("delivery.zonePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(deliveryZones ?? []).map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name} — {formatPrice(zone.feeMinor, currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedZone && selectedZone.minBasketMinor > 0 && (
                <p className="text-xs text-[var(--fg-faint)]">
                  {t("delivery.minBasketHint", { amount: formatPrice(selectedZone.minBasketMinor, currency) })}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="delivery-address">{t("delivery.address")}</Label>
              <Textarea id="delivery-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="delivery-scheduled">{t("delivery.scheduledFor")}</Label>
              <Input
                id="delivery-scheduled"
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex items-stretch gap-2">
          {itemCount > 0 ? (
            <button
              type="button"
              disabled={status === "submitting" || !canSubmit}
              onClick={handleSubmit}
              className="flex min-h-[52px] flex-1 items-center gap-3 rounded-full bg-[var(--accent)] px-4 text-[var(--accent-fg)] shadow-lg backdrop-blur transition-opacity disabled:opacity-60"
            >
              <span
                data-bumped={bumped ? "true" : undefined}
                className="flex size-6 items-center justify-center rounded-full bg-black/20 text-xs font-bold tabular-nums transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] data-[bumped=true]:scale-125"
              >
                {itemCount}
              </span>
              {/* §5: "N ürün" GÖRÜNÜR bir metin sözleşmesidir —
                  order-submission.spec.ts onu getByText ile arıyor. Rozet
                  rakamı tek başına yeterli değil; hem sözleşme hem de
                  rakamın ne anlama geldiği için etiket burada duruyor. */}
              <span className="flex flex-col items-start leading-tight">
                <span className="text-[11px] opacity-80">{t("itemCount", { count: itemCount })}</span>
                <span className="text-sm font-semibold">
                  {status === "submitting" ? t("submitting") : t("submit")}
                </span>
              </span>
              <span className="ml-auto text-sm font-bold tabular-nums">
                {formatPrice(subtotalMinor + (selectedZone?.feeMinor ?? 0), currency)}
              </span>
            </button>
          ) : (
            /* Adım 0 kabul kriteri 3 — boş sepet tasarımsız kalmaz. */
            <div className="flex min-h-[52px] flex-1 flex-col justify-center rounded-full bg-[var(--card)]/90 px-4 shadow-lg backdrop-blur">
              <p className="text-sm font-medium text-[var(--fg-muted)]">{t("empty")}</p>
              <p className="text-[11px] leading-tight text-[var(--fg-faint)]">{t("emptyHint")}</p>
            </div>
          )}
          {trailing}
        </div>
      </div>
    </div>
  );
}
