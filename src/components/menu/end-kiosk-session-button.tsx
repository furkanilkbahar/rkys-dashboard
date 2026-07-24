"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export function EndKioskSessionButton({
  pairingCode,
  endKioskSession,
}: {
  pairingCode: string;
  endKioskSession: () => Promise<void>;
}) {
  const t = useTranslations("menu.kiosk");

  async function handleClick() {
    await endKioskSession();
    window.location.href = `/kiosk/${pairingCode}/baslat`;
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick}>
      {t("nextCustomer")}
    </Button>
  );
}
