import { getTranslations } from "next-intl/server";

export default async function TenantNotFoundPage() {
  const t = await getTranslations("tenantNotFound");

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{t("title")}</p>
    </main>
  );
}
