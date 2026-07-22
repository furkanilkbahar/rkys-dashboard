"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { signOutCurrentDevice } from "@/lib/auth/signOut";

export function PlatformLogoutButton() {
  const t = useTranslations("platform.topbar");

  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => signOutCurrentDevice("/platform/login")}>
      {t("logout")}
    </Button>
  );
}
