import { getTranslations } from "next-intl/server";

import { LegalPage } from "../legal-page";

export default async function VeriSilmePage() {
  const t = await getTranslations("legal");

  return (
    <LegalPage title={t("veriSilme.title")} notice={t("draftNotice")}>
      <p>{t("veriSilme.p1")}</p>
      <p>{t("veriSilme.p2")}</p>
      <p className="font-medium">{t("veriSilme.cta")}</p>
    </LegalPage>
  );
}
