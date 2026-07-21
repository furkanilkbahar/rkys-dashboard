"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { signOutCurrentDevice } from "@/lib/auth/signOut";

export function CashierLogoutButton() {
  const t = useTranslations("admin.topbar");

  return (
    <Button type="button" variant="ghost" size="sm" onClick={signOutCurrentDevice}>
      {t("logout")}
    </Button>
  );
}
