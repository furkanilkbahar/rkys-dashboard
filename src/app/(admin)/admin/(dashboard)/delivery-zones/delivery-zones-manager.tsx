"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AdminDeliveryZone } from "@/lib/data/deliveryZones";
import { deliveryZoneFormSchema, type DeliveryZoneActionResult, type DeliveryZoneFormInput } from "@/lib/delivery/schemas";
import { formatPrice } from "@/lib/utils/currency";

export function DeliveryZonesManager({
  zones,
  currency,
  createZone,
  toggleZone,
}: {
  zones: AdminDeliveryZone[];
  currency: string;
  createZone: (input: unknown) => Promise<DeliveryZoneActionResult>;
  toggleZone: (zoneId: string, isActive: boolean) => Promise<DeliveryZoneActionResult>;
}) {
  const t = useTranslations("admin.deliveryZones");
  const tErrors = useTranslations("admin.deliveryZones.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<DeliveryZoneFormInput>({
    resolver: standardSchemaResolver(deliveryZoneFormSchema),
    defaultValues: { name: "", fee: "", minBasket: "0" },
  });

  async function onSubmit(values: DeliveryZoneFormInput) {
    setError(null);
    const result = await createZone(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    reset({ name: "", fee: "", minBasket: "0" });
    router.refresh();
  }

  async function handleToggle(zoneId: string, isActive: boolean) {
    await toggleZone(zoneId, isActive);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{t("pageTitle")}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {zones.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
          {zones.map((zone) => (
            <div key={zone.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{zone.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t("feeLabel")}: {formatPrice(zone.feeMinor, currency)} · {t("minBasketLabel")}: {formatPrice(zone.minBasketMinor, currency)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`zone-active-${zone.id}`} className="text-xs text-muted-foreground">
                  {t("active")}
                </Label>
                <Switch id={`zone-active-${zone.id}`} checked={zone.isActive} onCheckedChange={(checked) => handleToggle(zone.id, checked)} />
              </div>
            </div>
          ))}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="zone-name">{t("name")}</Label>
              <Input id="zone-name" className="w-40" {...register("name")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="zone-fee">{t("fee")}</Label>
              <Input id="zone-fee" className="w-24" inputMode="decimal" placeholder="0.00" {...register("fee")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="zone-min-basket">{t("minBasket")}</Label>
              <Input id="zone-min-basket" className="w-24" inputMode="decimal" placeholder="0.00" {...register("minBasket")} />
            </div>
            <Button type="submit" size="sm">
              {t("add")}
            </Button>
          </form>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
