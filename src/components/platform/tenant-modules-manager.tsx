"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { PlatformTenantModule, TenantModuleSource } from "@/lib/data/platformTenants";
import type { PlatformActionResult } from "@/lib/platform/schemas";

const SOURCES: TenantModuleSource[] = ["plan", "paid_addon", "granted"];

export function TenantModulesManager({
  tenantId,
  modules,
  setTenantModule,
}: {
  tenantId: string;
  modules: PlatformTenantModule[];
  setTenantModule: (
    tenantId: string,
    moduleKey: string,
    isEnabled: boolean,
    source: TenantModuleSource,
  ) => Promise<PlatformActionResult>;
}) {
  const t = useTranslations("admin.settings.modules.keys");
  const tSource = useTranslations("platform.tenantDetail.moduleSource");
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {modules.map((module) => (
        <div key={module.moduleKey} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
          <span>{t(module.moduleKey)}</span>
          <div className="flex items-center gap-2">
            <Select
              value={module.source}
              disabled={pendingKey === module.moduleKey}
              onValueChange={async (value) => {
                setPendingKey(module.moduleKey);
                await setTenantModule(tenantId, module.moduleKey, module.isEnabled, value as TenantModuleSource);
                setPendingKey(null);
                router.refresh();
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((source) => (
                  <SelectItem key={source} value={source}>
                    {tSource(source)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Switch
              checked={module.isEnabled}
              disabled={pendingKey === module.moduleKey}
              onCheckedChange={async (checked) => {
                setPendingKey(module.moduleKey);
                await setTenantModule(tenantId, module.moduleKey, checked, module.source);
                setPendingKey(null);
                router.refresh();
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
