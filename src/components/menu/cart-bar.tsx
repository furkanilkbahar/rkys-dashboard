"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SubmitOrderInput, SubmitOrderResult } from "@/lib/orders/schemas";
import { useCartStore } from "@/lib/store/cart";
import { formatPrice } from "@/lib/utils/currency";

export type DeliveryZoneOption = { id: string; name: string; feeMinor: number; minBasketMinor: number };

export function CartBar({
  currency,
  onSubmit,
  deliveryZones,
}: {
  currency: string;
  onSubmit: (input: SubmitOrderInput) => Promise<SubmitOrderResult>;
  deliveryZones?: DeliveryZoneOption[];
}) {
  const t = useTranslations("menu.cart");
  const lines = useCartStore((state) => state.lines);
  const clear = useCartStore((state) => state.clear);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string>("");
  const [address, setAddress] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotalMinor = lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  const selectedZone = deliveryZones?.find((z) => z.id === zoneId);
  const isDelivery = deliveryZones !== undefined;
  const canSubmit = !isDelivery || (zoneId !== "" && address.trim().length > 0);

  if (itemCount === 0 && status !== "success") {
    return null;
  }

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

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background p-4 shadow-lg">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {status === "success" && <p className="text-sm text-primary">{t("success")}</p>}
        {status === "error" && errorKey && <p className="text-sm text-destructive">{t(errorKey)}</p>}
        {itemCount > 0 && isDelivery && (
          <div className="flex flex-col gap-2 border-b border-border pb-2">
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
                <p className="text-xs text-muted-foreground">
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
        {itemCount > 0 && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">{t("itemCount", { count: itemCount })}</p>
            <p className="text-sm font-semibold">{formatPrice(subtotalMinor + (selectedZone?.feeMinor ?? 0), currency)}</p>
            <Button type="button" disabled={status === "submitting" || !canSubmit} onClick={handleSubmit}>
              {status === "submitting" ? t("submitting") : t("submit")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
