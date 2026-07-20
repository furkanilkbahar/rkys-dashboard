"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

export function LogoutMenuItem() {
  const t = useTranslations("admin.topbar");

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/admin/login");
  }

  return (
    <DropdownMenuItem onClick={handleLogout} variant="destructive">
      <LogOut className="size-4" aria-hidden="true" />
      {t("logout")}
    </DropdownMenuItem>
  );
}
