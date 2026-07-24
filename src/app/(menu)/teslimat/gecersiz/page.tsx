import { getTranslations } from "next-intl/server";

export default async function InvalidDeliveryPage() {
  const t = await getTranslations("menu.invalidDelivery");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="text-sm font-medium">{t("title")}</p>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
    </main>
  );
}
