import { getTranslations } from "next-intl/server";

export default async function BlogIndexPage() {
  const t = await getTranslations("blog");

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-6 py-24 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.9rem,3.8vw,2.5rem)] leading-tight font-semibold tracking-[-0.022em]">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("comingSoon")}</p>
    </main>
  );
}
