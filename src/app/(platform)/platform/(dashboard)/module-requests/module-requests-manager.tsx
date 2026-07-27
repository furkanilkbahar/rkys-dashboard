"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PendingModuleRequest } from "@/lib/data/platformTenants";
import type { PlatformActionResult } from "@/lib/platform/schemas";

function ModuleRequestRow({
  request,
  resolveModuleRequest,
}: {
  request: PendingModuleRequest;
  resolveModuleRequest: (requestId: string, approve: boolean) => Promise<PlatformActionResult>;
}) {
  const t = useTranslations("platform.moduleRequests");
  const tModules = useTranslations("admin.settings.modules.keys");
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);

  async function handleResolve(approve: boolean) {
    setPendingAction(approve ? "approve" : "reject");
    await resolveModuleRequest(request.id, approve);
    setPendingAction(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{request.tenantName}</span>
          <span className="text-sm text-muted-foreground">({request.tenantSlug})</span>
        </div>
        <span className="text-sm text-muted-foreground">{tModules(request.moduleKey)}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={pendingAction !== null} onClick={() => handleResolve(true)}>
          {t("approve")}
        </Button>
        <Button size="sm" variant="destructive" disabled={pendingAction !== null} onClick={() => handleResolve(false)}>
          {t("reject")}
        </Button>
      </div>
    </div>
  );
}

export function ModuleRequestsManager({
  requests,
  resolveModuleRequest,
}: {
  requests: PendingModuleRequest[];
  resolveModuleRequest: (requestId: string, approve: boolean) => Promise<PlatformActionResult>;
}) {
  const t = useTranslations("platform.moduleRequests");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("queueTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {requests.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
          {requests.map((request) => (
            <ModuleRequestRow key={request.id} request={request} resolveModuleRequest={resolveModuleRequest} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
