import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/admin/coming-soon";

export default async function AdminTablesPage() {
  const t = await getTranslations("admin.nav");

  return <ComingSoon section={t("tables")} adim="Adım 4" />;
}
