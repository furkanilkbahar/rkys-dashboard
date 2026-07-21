"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { signOutCurrentDevice } from "@/lib/auth/signOut";

export function LogoutMenuItem() {
  const t = useTranslations("admin.topbar");

  return (
    <DropdownMenuItem onClick={signOutCurrentDevice} variant="destructive">
      <LogOut className="size-4" aria-hidden="true" />
      {t("logout")}
    </DropdownMenuItem>
  );
}
