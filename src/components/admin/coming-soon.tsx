import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function ComingSoon({ section, adim }: { section: string; adim: string }) {
  const t = await getTranslations("admin.common");

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>{t("comingSoonTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {t("comingSoonBody", { section, adim })}
      </CardContent>
    </Card>
  );
}
