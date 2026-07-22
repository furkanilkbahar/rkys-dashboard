import { getTranslations } from "next-intl/server";

import { LegalPage } from "../legal-page";

export default async function SozlesmePage() {
  const t = await getTranslations("legal");

  return (
    <LegalPage title={t("sozlesme.title")} notice={t("draftNotice")}>
      <p>{t("sozlesme.p1")}</p>
      <p>{t("sozlesme.p2")}</p>
      <p>{t("sozlesme.p3")}</p>
      <p>{t("sozlesme.p4")}</p>
    </LegalPage>
  );
}
