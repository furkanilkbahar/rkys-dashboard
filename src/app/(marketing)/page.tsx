import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMarketingPlans } from "@/lib/data/plans";
import { MODULE_KEYS } from "@/lib/modules/keys";

const FEATURE_KEYS = ["qrMenu", "kitchenDisplay", "cashier", "reports", "modular"] as const;
const VALUE_KEYS = ["guest", "staff", "owner"] as const;
const INTEGRATION_NAMES = ["Yemeksepeti", "Getir", "Trendyol", "iyzico", "Logo", "Mikro", "Paraşüt"] as const;
const TRUST_KEYS = ["isolation", "moduleDiscipline", "trial", "selfHosted"] as const;

function formatPriceMinor(priceMinor: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(
    priceMinor / 100,
  );
}

export default async function MarketingHomePage() {
  const t = await getTranslations("marketing");
  const tModules = await getTranslations("admin.settings.modules.keys");
  const plans = await getMarketingPlans();

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

      <section className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
        {VALUE_KEYS.map((key) => (
          <div key={key} className="flex flex-col gap-1 text-center sm:text-left">
            <h3 className="text-base font-semibold">{t(`value.${key}.title`)}</h3>
            <p className="text-sm text-muted-foreground">{t(`value.${key}.body`)}</p>
          </div>
        ))}
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

      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6">
        <h2 className="text-2xl font-semibold">{t("moduleShowcase.title")}</h2>
        <p className="max-w-2xl text-center text-sm text-muted-foreground">{t("moduleShowcase.subtitle")}</p>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_KEYS.map((key) => (
            <div key={key} className="flex flex-col gap-1 rounded-lg border border-border p-3">
              <span className="text-sm font-medium">{tModules(key)}</span>
              <span className="text-xs text-muted-foreground">{t(`moduleShowcase.descriptions.${key}`)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground">{t("integrations.title")}</p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {INTEGRATION_NAMES.map((name) => (
            <span key={name} className="text-sm font-medium text-muted-foreground">
              {name}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6">
        <h2 className="text-2xl font-semibold">{t("pricing.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("pricing.subtitle")}</p>
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader className="flex flex-col gap-1">
                <CardTitle>{plan.name}</CardTitle>
                <p className="text-2xl font-semibold">
                  {formatPriceMinor(plan.priceMinor)}
                  <span className="text-sm font-normal text-muted-foreground">{t("pricing.perMonth")}</span>
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
                <p>{plan.tableLimit === null ? t("pricing.unlimitedTables") : t("pricing.tableCount", { count: plan.tableLimit })}</p>
                <p>{t("pricing.branchCount", { count: plan.includedBranchCount })}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {plan.moduleKeys.map((key) => (
                    <Badge key={key} variant="secondary" className="font-normal">
                      {tModules(key)}
                    </Badge>
                  ))}
                </div>
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

      <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6">
        <h2 className="text-2xl font-semibold">{t("trust.title")}</h2>
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          {TRUST_KEYS.map((key) => (
            <div key={key} className="flex flex-col gap-1 rounded-lg border border-border p-4">
              <span className="text-sm font-semibold">{t(`trust.items.${key}.title`)}</span>
              <span className="text-sm text-muted-foreground">{t(`trust.items.${key}.body`)}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-4xl flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <Link href="/sss" className="hover:text-foreground">
          {t("nav.faq")}
        </Link>
        <Link href="/blog" className="hover:text-foreground">
          {t("footer.blog")}
        </Link>
        <Link href="/gelistirici" className="hover:text-foreground">
          {t("footer.developers")}
        </Link>
        <Link href="/donanim" className="hover:text-foreground">
          {t("footer.hardware")}
        </Link>
        <Link href="/iletisim" className="hover:text-foreground">
          {t("nav.contact")}
        </Link>
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
