"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Switch } from "@/components/ui/switch";

import { setAutoApproveRegistrations, setEnforce2fa } from "./actions";

export function SettingsManager({
  enforce2fa,
  autoApproveRegistrations,
}: {
  enforce2fa: boolean;
  autoApproveRegistrations: boolean;
}) {
  const t = useTranslations("platform.settings");
  const [enforce2faChecked, setEnforce2faChecked] = useState(enforce2fa);
  const [autoApproveChecked, setAutoApproveChecked] = useState(autoApproveRegistrations);
  const [isPending, setIsPending] = useState(false);

  async function handleEnforce2faChange(value: boolean) {
    setEnforce2faChecked(value);
    setIsPending(true);
    await setEnforce2fa(value);
    setIsPending(false);
  }

  async function handleAutoApproveChange(value: boolean) {
    setAutoApproveChecked(value);
    setIsPending(true);
    await setAutoApproveRegistrations(value);
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
        <Switch checked={enforce2faChecked} disabled={isPending} onCheckedChange={handleEnforce2faChange} />
      </div>
      <div className="flex items-center justify-between rounded-md border border-border p-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("autoApproveRegistrationsLabel")}</span>
          <span className="text-sm text-muted-foreground">{t("autoApproveRegistrationsDescription")}</span>
        </div>
        <Switch checked={autoApproveChecked} disabled={isPending} onCheckedChange={handleAutoApproveChange} />
      </div>
    </div>
  );
}
