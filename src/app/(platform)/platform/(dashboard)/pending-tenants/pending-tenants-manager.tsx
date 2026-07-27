"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PendingTenant } from "@/lib/data/platformTenants";
import type { PlatformActionResult } from "@/lib/platform/schemas";

function PendingTenantRow({
  tenant,
  approveTenant,
  rejectTenant,
}: {
  tenant: PendingTenant;
  approveTenant: (tenantId: string) => Promise<PlatformActionResult>;
  rejectTenant: (tenantId: string) => Promise<PlatformActionResult>;
}) {
  const t = useTranslations("platform.pendingTenants");
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);

  async function handleApprove() {
    setPendingAction("approve");
    await approveTenant(tenant.id);
    setPendingAction(null);
    router.refresh();
  }

  async function handleReject() {
    setPendingAction("reject");
    await rejectTenant(tenant.id);
    setPendingAction(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{tenant.name}</span>
          <span className="text-sm text-muted-foreground">({tenant.slug})</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{tenant.planName ?? t("noPlan")}</span>
          <Badge variant={tenant.subscriptionStatus === "active" ? "secondary" : "outline"}>
            {tenant.subscriptionStatus ? t(`subscriptionStatus.${tenant.subscriptionStatus}`) : t("noSubscription")}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={pendingAction !== null} onClick={handleApprove}>
          {t("approve")}
        </Button>
        <Button size="sm" variant="destructive" disabled={pendingAction !== null} onClick={handleReject}>
          {t("reject")}
        </Button>
      </div>
    </div>
  );
}

export function PendingTenantsManager({
  tenants,
  approveTenant,
  rejectTenant,
}: {
  tenants: PendingTenant[];
  approveTenant: (tenantId: string) => Promise<PlatformActionResult>;
  rejectTenant: (tenantId: string) => Promise<PlatformActionResult>;
}) {
  const t = useTranslations("platform.pendingTenants");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("queueTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {tenants.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
          {tenants.map((tenant) => (
            <PendingTenantRow key={tenant.id} tenant={tenant} approveTenant={approveTenant} rejectTenant={rejectTenant} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
