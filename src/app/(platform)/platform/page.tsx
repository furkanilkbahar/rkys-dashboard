import { getTranslations } from "next-intl/server";

export default async function PlatformHomePage() {
  const t = await getTranslations("placeholders");

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{t("platform")}</p>
    </main>
  );
}
