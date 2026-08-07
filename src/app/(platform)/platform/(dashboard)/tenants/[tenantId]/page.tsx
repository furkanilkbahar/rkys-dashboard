import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PlatformPageHeader } from "@/components/platform/platform-page-header";
import { Badge } from "@/components/ui/badge";
import { SuspendToggleButton } from "@/components/platform/suspend-toggle-button";
import { MarkPaidButton } from "@/components/platform/mark-paid-button";
import { PendingModuleRemovals } from "@/components/platform/pending-module-removals";
import { PlanSelect } from "@/components/platform/plan-select";
import { TenantModulesManager } from "@/components/platform/tenant-modules-manager";
import { getPlatformPlans, getPlatformTenantDetail } from "@/lib/data/platformTenants";

import {
  assignTenantPlan,
  markSubscriptionPaid,
  reactivateTenant,
  resolvePendingModuleRemoval,
  setTenantModule,
  suspendTenant,
} from "../actions";

export default async function PlatformTenantDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const t = await getTranslations("platform");
  const [tenant, plans] = await Promise.all([getPlatformTenantDetail(tenantId), getPlatformPlans()]);

  if (!tenant) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <PlatformPageHeader title={tenant.name} />
        <Badge variant={tenant.status === "active" ? "secondary" : "destructive"}>{t(`status.${tenant.status}`)}</Badge>
        {(tenant.status === "active" || tenant.status === "suspended") && (
          <SuspendToggleButton
            tenantId={tenant.id}
            status={tenant.status}
            suspendTenant={suspendTenant}
            reactivateTenant={reactivateTenant}
          />
        )}
      </div>
      <p className="text-sm text-muted-foreground">{tenant.slug}</p>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t("tenantDetail.planTitle")}</h2>
        <PlanSelect tenantId={tenant.id} planId={tenant.planId} plans={plans} assignTenantPlan={assignTenantPlan} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t("tenantDetail.subscriptionTitle")}</h2>
        {tenant.subscription ? (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={tenant.subscription.status === "active" ? "secondary" : "outline"}>
              {t(`tenantDetail.subscriptionStatus.${tenant.subscription.status}`)}
            </Badge>
            {tenant.subscription.status === "trialing" && tenant.subscription.trialEndsAt && (
              <span className="text-muted-foreground">
                {t("tenantDetail.trialEndsAt", { date: new Date(tenant.subscription.trialEndsAt).toLocaleDateString("tr-TR") })}
              </span>
            )}
            {tenant.subscription.status === "active" && tenant.subscription.currentPeriodEnd && (
              <span className="text-muted-foreground">
                {t("tenantDetail.currentPeriodEnd", {
                  date: new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString("tr-TR"),
                })}
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("tenantDetail.noSubscription")}</p>
        )}
        {/* D101: aboneliği zaten aktif olan tenant'ta gizli — o durumda
            "ödemesi alındı" demek yalnızca dönemi 30 gün ileri iter ve
            yanlışlıkla basılması sessiz bir bedava uzatmaya dönüşür. */}
        {tenant.subscription && tenant.subscription.status !== "active" && (
          <MarkPaidButton tenantId={tenant.id} markSubscriptionPaid={markSubscriptionPaid} />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t("tenantDetail.branchesTitle")}</h2>
        {tenant.branches.map((branch) => (
          <div key={branch.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
            <span>{branch.name}</span>
            {branch.isDefault && <Badge variant="secondary">{t("tenantDetail.defaultBranch")}</Badge>}
          </div>
        ))}
      </div>

      <PendingModuleRemovals
        tenantId={tenant.id}
        modules={tenant.modules}
        resolvePendingModuleRemoval={resolvePendingModuleRemoval}
      />

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t("tenantDetail.modulesTitle")}</h2>
        <TenantModulesManager tenantId={tenant.id} modules={tenant.modules} setTenantModule={setTenantModule} />
      </div>
    </div>
  );
}
