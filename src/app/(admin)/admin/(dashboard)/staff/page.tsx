import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/admin/coming-soon";

export default async function AdminStaffPage() {
  const t = await getTranslations("admin.nav");

  return <ComingSoon section={t("staff")} adim="Adım 5" />;
}
