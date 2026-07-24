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
import type { AdminKioskDevice } from "@/lib/data/kiosk";
import { kioskDeviceFormSchema, type KioskActionResult, type KioskDeviceFormInput } from "@/lib/kiosk/schemas";

export function KioskManager({
  devices,
  createKioskDevice,
  toggleKioskDevice,
}: {
  devices: AdminKioskDevice[];
  createKioskDevice: (input: unknown) => Promise<KioskActionResult>;
  toggleKioskDevice: (deviceId: string, isActive: boolean) => Promise<KioskActionResult>;
}) {
  const t = useTranslations("admin.kiosk");
  const tErrors = useTranslations("admin.kiosk.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<KioskDeviceFormInput>({
    resolver: standardSchemaResolver(kioskDeviceFormSchema),
    defaultValues: { deviceName: "" },
  });

  async function onSubmit(values: KioskDeviceFormInput) {
    setError(null);
    const result = await createKioskDevice(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    reset({ deviceName: "" });
    router.refresh();
  }

  async function handleToggle(deviceId: string, isActive: boolean) {
    await toggleKioskDevice(deviceId, isActive);
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
          {devices.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
          {devices.map((device) => (
            <div key={device.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <div className="flex flex-col">
                <span className="font-medium">{device.deviceName}</span>
                <span className="text-xs text-muted-foreground">{t("pairingUrlHint", { path: `/kiosk/${device.pairingCode}/baslat` })}</span>
                <code className="text-xs text-muted-foreground">{device.pairingCode}</code>
              </div>
              <Switch checked={device.isActive} onCheckedChange={(checked) => handleToggle(device.id, checked)} />
            </div>
          ))}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="kiosk-device-name">{t("deviceName")}</Label>
              <Input id="kiosk-device-name" className="w-48" {...register("deviceName")} />
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
