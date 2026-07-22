import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { SuspendToggleButton } from "@/components/platform/suspend-toggle-button";
import { getPlatformTenantDetail } from "@/lib/data/platformTenants";

import { reactivateTenant, suspendTenant } from "../actions";

export default async function PlatformTenantDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const t = await getTranslations("platform");
  const tenant = await getPlatformTenantDetail(tenantId);

  if (!tenant) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{tenant.name}</h1>
        <Badge variant={tenant.status === "active" ? "secondary" : "destructive"}>{t(`status.${tenant.status}`)}</Badge>
        <SuspendToggleButton
          tenantId={tenant.id}
          status={tenant.status}
          suspendTenant={suspendTenant}
          reactivateTenant={reactivateTenant}
        />
      </div>
      <p className="text-sm text-muted-foreground">{tenant.slug}</p>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t("tenantDetail.branchesTitle")}</h2>
        {tenant.branches.map((branch) => (
          <div key={branch.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
            <span>{branch.name}</span>
            {branch.isDefault && <Badge variant="secondary">{t("tenantDetail.defaultBranch")}</Badge>}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t("tenantDetail.modulesTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          {tenant.enabledModules.length === 0 && <p className="text-sm text-muted-foreground">{t("tenantDetail.noModules")}</p>}
          {tenant.enabledModules.map((moduleKey) => (
            <Badge key={moduleKey} variant="secondary">
              {moduleKey}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
