import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function MarketingHomePage() {
  const t = await getTranslations("placeholders");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>RKYS Dashboard</CardTitle>
          <Badge variant="secondary">warm-luxury</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t("marketingCardBody")}</p>
          <Button>{t("marketingCardButton")}</Button>
        </CardContent>
      </Card>
    </main>
  );
}