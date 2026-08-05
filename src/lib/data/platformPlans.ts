import "server-only";

import { MODULE_KEYS, type ModuleKey } from "@/lib/modules/keys";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type PlatformPlanDetail = {
  id: string;
  key: string;
  name: string;
  priceMinor: number;
  tableLimit: number | null;
  includedBranchCount: number;
  extraBranchPriceMinor: number;
  isPublic: boolean;
  moduleKeys: ModuleKey[];
};

// Süper Admin salt-okunur görünümü: gate zaten layout'ta requirePlatformAdmin()
// ile yapılıyor (platformTenants.ts'teki aynı gerekçe) — service-role
// kullanılıyor.
export async function listPlatformPlans(): Promise<PlatformPlanDetail[]> {
  const service = createServiceRoleClient();
  const [{ data: plans }, { data: planModules }] = await Promise.all([
    service
      .from("plans")
      .select("id, key, name, price_minor, table_limit, included_branch_count, extra_branch_price_minor, is_public")
      .order("price_minor"),
    service.from("plan_modules").select("plan_id, module_key"),
  ]);

  const moduleKeysByPlan = new Map<string, ModuleKey[]>();
  for (const row of planModules ?? []) {
    const list = moduleKeysByPlan.get(row.plan_id) ?? [];
    list.push(row.module_key as ModuleKey);
    moduleKeysByPlan.set(row.plan_id, list);
  }

  return (plans ?? []).map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    priceMinor: p.price_minor,
    tableLimit: p.table_limit,
    includedBranchCount: p.included_branch_count,
    extraBranchPriceMinor: p.extra_branch_price_minor,
    isPublic: p.is_public,
    moduleKeys: moduleKeysByPlan.get(p.id) ?? [],
  }));
}

export type ModuleAddonPrice = {
  moduleKey: ModuleKey;
  priceMinor: number;
};

// Faz 15 Adım 2 (S64): 15 modülün à la carte satın alma fiyatı — hiç
// fiyatlanmamış (satılmıyor) modüller 0 olarak döner.
export async function getModuleAddonPrices(): Promise<ModuleAddonPrice[]> {
  const service = createServiceRoleClient();
  const { data } = await service.from("module_addon_prices").select("module_key, price_minor");
  const priceByModule = new Map((data ?? []).map((p) => [p.module_key, p.price_minor]));

  return MODULE_KEYS.map((moduleKey) => ({
    moduleKey,
    priceMinor: priceByModule.get(moduleKey) ?? 0,
  }));
}
