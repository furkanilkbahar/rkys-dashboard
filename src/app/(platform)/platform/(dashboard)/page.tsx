import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PlatformPageHeader } from "@/components/platform/platform-page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformStats, getPlatformTenants } from "@/lib/data/platformTenants";

export default async function PlatformDashboardPage() {
  const t = await getTranslations("platform");
  const [stats, tenants] = await Promise.all([getPlatformStats(), getPlatformTenants()]);

  return (
    <div className="flex flex-col gap-6">
      <PlatformPageHeader title={t("dashboard.title")} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t("dashboard.totalTenants")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.totalTenants}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t("dashboard.activeTenants")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.activeTenants}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t("dashboard.totalBranches")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.totalBranches}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t("dashboard.totalTables")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.totalTables}</CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t("dashboard.tenantsTitle")}</h2>
        {tenants.map((tenant) => (
          <Link
            key={tenant.id}
            href={`/platform/tenants/${tenant.id}`}
            className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-accent"
          >
            <span className="flex items-center gap-2">
              <span className="font-medium">{tenant.name}</span>
              <span className="text-muted-foreground">({tenant.slug})</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">{t("dashboard.branchCount", { count: tenant.branchCount })}</span>
              <Badge variant={tenant.status === "active" ? "secondary" : "destructive"}>{t(`status.${tenant.status}`)}</Badge>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
