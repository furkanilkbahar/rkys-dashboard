import { getTranslations } from "next-intl/server";

export default async function BlogIndexPage() {
  const t = await getTranslations("blog");

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("comingSoon")}</p>
    </main>
  );
}
