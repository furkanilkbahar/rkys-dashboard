import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/admin/coming-soon";

export default async function AdminSettingsPage() {
  const t = await getTranslations("admin.nav");

  return <ComingSoon section={t("settings")} adim="Adım 6" />;
}
