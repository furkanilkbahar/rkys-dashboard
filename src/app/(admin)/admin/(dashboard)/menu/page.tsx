import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/admin/coming-soon";

export default async function AdminMenuPage() {
  const t = await getTranslations("admin.nav");

  return <ComingSoon section={t("menu")} adim="Adım 1" />;
}
