import { getTranslations } from "next-intl/server";

import { LegalPage } from "../legal-page";

export default async function KvkkPage() {
  const t = await getTranslations("legal");

  return (
    <LegalPage title={t("kvkk.title")} notice={t("draftNotice")}>
      <p>{t("kvkk.p1")}</p>
      <p>{t("kvkk.p2")}</p>
      <p>{t("kvkk.p3")}</p>
      <p>{t("kvkk.p4")}</p>
    </LegalPage>
  );
}
