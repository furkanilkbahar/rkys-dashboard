"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * D101: "parası alındı" işareti (havale/EFT, saha tahsilatı). SuspendToggleButton
 * ile aynı desen — tek fark, başarısızlığın sessizce yutulmaması: burada
 * platform admin'in bir tahsilatı işlediğini sanıp bırakması, tenant'ın ödeme
 * yaptığı hâlde kapalı kalması demek.
 */
export function MarkPaidButton({
  tenantId,
  markSubscriptionPaid,
}: {
  tenantId: string;
  markSubscriptionPaid: (tenantId: string) => Promise<{ ok: boolean }>;
}) {
  const t = useTranslations("platform.tenantDetail");
  const [isPending, setIsPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setFailed(false);
    setIsPending(true);
    const result = await markSubscriptionPaid(tenantId);
    setIsPending(false);
    if (!result.ok) setFailed(true);
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="outline" className="w-fit" disabled={isPending} onClick={handleClick}>
        {t("markPaid")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("markPaidHint")}</p>
      {failed && <p className="text-xs text-destructive">{t("markPaidError")}</p>}
    </div>
  );
}
