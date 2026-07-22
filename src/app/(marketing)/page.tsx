import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlans } from "@/lib/data/plans";

const PLAN_DETAILS: Record<string, { tables: string; branches: string }> = {
  starter: { tables: "10", branches: "1" },
  pro: { tables: "25", branches: "2" },
  unlimited: { tables: "∞", branches: "3" },
};

const FEATURE_KEYS = ["qrMenu", "kitchenDisplay", "cashier", "reports", "modular"] as const;

export default async function MarketingHomePage() {
  const t = await getTranslations("marketing");
  const plans = await getPlans();

  return (
    <main className="flex flex-col gap-16 px-6 py-16">
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-semibold">{t("hero.title")}</h1>
        <p className="text-lg text-muted-foreground">{t("hero.subtitle")}</p>
        <Link href="/kayit">
          <Button size="lg">{t("hero.cta")}</Button>
        </Link>
        <p className="text-xs text-muted-foreground">{t("hero.trialNote")}</p>
      </section>

      <section className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURE_KEYS.map((key) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-base">{t(`features.${key}.title`)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t(`features.${key}.body`)}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6">
        <h2 className="text-2xl font-semibold">{t("pricing.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("pricing.draftNotice")}</p>
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                <p>{t("pricing.tableCount", { count: PLAN_DETAILS[plan.key]?.tables ?? "—" })}</p>
                <p>{t("pricing.branchCount", { count: PLAN_DETAILS[plan.key]?.branches ?? "—" })}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm">{t("pricing.enterpriseBody")}</p>
            <a href="mailto:destek@rkys.app">
              <Button variant="outline">{t("pricing.enterpriseCta")}</Button>
            </a>
          </CardContent>
        </Card>
      </section>

      <footer className="mx-auto flex max-w-4xl flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <Link href="/legal/kvkk" className="hover:text-foreground">
          {t("footer.kvkk")}
        </Link>
        <Link href="/legal/cerez" className="hover:text-foreground">
          {t("footer.cerez")}
        </Link>
        <Link href="/legal/sozlesme" className="hover:text-foreground">
          {t("footer.sozlesme")}
        </Link>
        <Link href="/legal/veri-silme" className="hover:text-foreground">
          {t("footer.veriSilme")}
        </Link>
      </footer>
    </main>
  );
}
