import { getTranslations } from "next-intl/server";

import { LegalPage } from "../legal-page";

export default async function CerezPage() {
  const t = await getTranslations("legal");

  return (
    <LegalPage title={t("cerez.title")} notice={t("draftNotice")}>
      <p>{t("cerez.p1")}</p>
      <p>{t("cerez.p2")}</p>
      <p>{t("cerez.p3")}</p>
    </LegalPage>
  );
}
