import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * D101: trial dolmuş / aboneliği bitmiş tenant'ın kapı sayfası. proxy.ts
 * `subscription_active=false` gördüğünde tenant'ın TÜM yüzeylerini (misafir
 * QR menüsü dahil) buraya yönlendirir; açık bıraktığı tek yol /admin/login
 * ve /admin/billing, yani ödeyip geri dönme yolu.
 *
 * tenant-not-found ile aynı desen: kök seviyede, tenant context'i gerektirmez.
 */
export default async function SubscriptionRequiredPage() {
  const t = await getTranslations("subscriptionRequired");

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t("body")}</p>
          <Link
            href="/admin/billing"
            className="inline-flex w-fit rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline"
          >
            {t("cta")}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
