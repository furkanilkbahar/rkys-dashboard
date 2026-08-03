import { getTranslations } from "next-intl/server";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminTenantName } from "@/lib/data/tenant";

export default async function AdminDashboardPage() {
  const actor = await requireAdminActor();
  const t = await getTranslations("admin.dashboard");
  const tenantName = (await getAdminTenantName(actor.tenantId)) ?? "—";

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader title={t("welcome", { tenantName })} />
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">{t("tenantLabel")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm font-medium">{tenantName}</CardContent>
      </Card>
    </div>
  );
}
