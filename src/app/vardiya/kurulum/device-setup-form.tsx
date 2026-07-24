"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DeviceSetupResult } from "@/lib/scheduling/schemas";

export function DeviceSetupForm({ setupDevice }: { setupDevice: (input: unknown) => Promise<DeviceSetupResult> }) {
  const t = useTranslations("timeclock.setup");
  const tErrors = useTranslations("timeclock.setup.errors");
  const router = useRouter();
  const [deviceSecret, setDeviceSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await setupDevice({ deviceSecret });
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.push("/vardiya");
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="device-secret">{t("deviceSecret")}</Label>
        <Input id="device-secret" value={deviceSecret} onChange={(e) => setDeviceSecret(e.target.value)} required />
      </div>
      <Button type="submit">{t("submit")}</Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
