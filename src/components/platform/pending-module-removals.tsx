"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlatformTenantModule } from "@/lib/data/platformTenants";
import type { PlatformActionResult } from "@/lib/platform/schemas";

export function PendingModuleRemovals({
  tenantId,
  modules,
  resolvePendingModuleRemoval,
}: {
  tenantId: string;
  modules: PlatformTenantModule[];
  resolvePendingModuleRemoval: (tenantId: string, moduleKey: string, keep: boolean) => Promise<PlatformActionResult>;
}) {
  const t = useTranslations("platform.tenantDetail.pendingRemovals");
  const tModules = useTranslations("admin.settings.modules.keys");
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const pending = modules.filter((m) => m.pendingRemovalSince !== null);
  if (pending.length === 0) {
    return null;
  }

  async function handleResolve(moduleKey: string, keep: boolean) {
    setPendingKey(moduleKey);
    await resolvePendingModuleRemoval(tenantId, moduleKey, keep);
    setPendingKey(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {pending.map((module) => (
          <div key={module.moduleKey} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
            <span>{tModules(module.moduleKey)}</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pendingKey === module.moduleKey}
                onClick={() => handleResolve(module.moduleKey, true)}
              >
                {t("keep")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={pendingKey === module.moduleKey}
                onClick={() => handleResolve(module.moduleKey, false)}
              >
                {t("remove")}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
