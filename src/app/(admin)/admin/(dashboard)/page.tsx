import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getCurrentTenant } from "@/lib/data/tenant";

export default async function AdminDashboardPage() {
  await requireAdminActor();
  const tenant = await getCurrentTenant();
  const t = await getTranslations("admin.dashboard");
  const tenantName = tenant?.name ?? tenant?.slug ?? "—";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("welcome", { tenantName })}</h1>
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">{t("tenantLabel")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm font-medium">{tenantName}</CardContent>
      </Card>
    </div>
  );
}
