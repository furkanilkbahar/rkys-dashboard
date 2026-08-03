import { getTranslations } from "next-intl/server";

import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion";

const CATEGORIES = ["registration", "plans", "hosting", "security"] as const;
const QUESTIONS_PER_CATEGORY: Record<(typeof CATEGORIES)[number], number> = {
  registration: 3,
  plans: 3,
  hosting: 2,
  security: 3,
};

export default async function FaqPage() {
  const t = await getTranslations("faq");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.9rem,3.8vw,2.5rem)] leading-tight font-semibold tracking-[-0.022em]">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {CATEGORIES.map((category) => (
        <section key={category} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t(`categories.${category}.title`)}</h2>
          <Accordion>
            {Array.from({ length: QUESTIONS_PER_CATEGORY[category] }, (_, i) => i).map((i) => (
              <AccordionItem key={i} value={`${category}-${i}`}>
                <AccordionTrigger>{t(`categories.${category}.items.${i}.q`)}</AccordionTrigger>
                <AccordionPanel>{t(`categories.${category}.items.${i}.a`)}</AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
    </main>
  );
}
