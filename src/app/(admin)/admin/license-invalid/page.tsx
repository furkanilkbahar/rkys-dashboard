import { getTranslations } from "next-intl/server";

export default async function LicenseInvalidPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const t = await getTranslations("admin.license");
  const knownReason = reason === "invalid_signature" || reason === "expired" || reason === "invalid_format" ? reason : "invalid_format";

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex max-w-md flex-col gap-2 text-center">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t(`reasons.${knownReason}`)}</p>
      </div>
    </main>
  );
}
