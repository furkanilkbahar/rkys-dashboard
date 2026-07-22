"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function SuspendToggleButton({
  tenantId,
  status,
  suspendTenant,
  reactivateTenant,
}: {
  tenantId: string;
  status: "active" | "suspended";
  suspendTenant: (tenantId: string) => Promise<{ ok: boolean }>;
  reactivateTenant: (tenantId: string) => Promise<{ ok: boolean }>;
}) {
  const t = useTranslations("platform.tenantDetail");
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setIsPending(true);
    if (status === "active") {
      await suspendTenant(tenantId);
    } else {
      await reactivateTenant(tenantId);
    }
    setIsPending(false);
  }

  return (
    <Button variant={status === "active" ? "destructive" : "default"} disabled={isPending} onClick={handleClick}>
      {status === "active" ? t("suspend") : t("reactivate")}
    </Button>
  );
}
