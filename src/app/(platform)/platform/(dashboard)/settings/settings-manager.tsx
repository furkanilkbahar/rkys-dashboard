"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Switch } from "@/components/ui/switch";

import { setEnforce2fa } from "./actions";

export function SettingsManager({ enforce2fa }: { enforce2fa: boolean }) {
  const t = useTranslations("platform.settings");
  const [checked, setChecked] = useState(enforce2fa);
  const [isPending, setIsPending] = useState(false);

  async function handleChange(value: boolean) {
    setChecked(value);
    setIsPending(true);
    await setEnforce2fa(value);
    setIsPending(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <div className="flex items-center justify-between rounded-md border border-border p-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("enforce2faLabel")}</span>
          <span className="text-sm text-muted-foreground">{t("enforce2faDescription")}</span>
        </div>
        <Switch checked={checked} disabled={isPending} onCheckedChange={handleChange} />
      </div>
    </div>
  );
}
