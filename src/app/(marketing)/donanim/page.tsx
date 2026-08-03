import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DEVICE_KEYS = ["guestMenu", "kitchenDisplay", "kiosk", "staffPanel"] as const;
const ROADMAP_KEYS = ["thermalPrinter", "cashDrawer", "barcodeScanner", "fiscalRegister"] as const;

export default async function HardwarePage() {
  const t = await getTranslations("hardware");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.9rem,3.8vw,2.5rem)] leading-tight font-semibold tracking-[-0.022em]">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t("today.title")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DEVICE_KEYS.map((key) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-base">{t(`today.items.${key}.title`)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t(`today.items.${key}.body`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t("roadmap.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("roadmap.subtitle")}</p>
        <ul className="flex flex-col gap-2">
          {ROADMAP_KEYS.map((key) => (
            <li key={key} className="rounded-lg border border-border p-3 text-sm">
              <span className="font-medium">{t(`roadmap.items.${key}.title`)}</span>
              <p className="text-muted-foreground">{t(`roadmap.items.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
