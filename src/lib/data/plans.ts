import "server-only";

import type { ModuleKey } from "@/lib/modules/keys";
import { createClient } from "@/lib/supabase/server";

export type Plan = {
  id: string;
  key: string;
  name: string;
  priceMinor: number;
};

// plans herkese açık okunur (marketing fiyatlandırma tablosu, Adım 6) —
// request-scoped client burada da yeterli, service-role'e gerek yok.
export async function getPlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plans")
    .select("id, key, name, price_minor")
    .order("table_limit", { ascending: true, nullsFirst: false });

  return (data ?? []).map((p) => ({ id: p.id, key: p.key, name: p.name, priceMinor: p.price_minor }));
}

export type MarketingPlan = Plan & {
  tableLimit: number | null;
  includedBranchCount: number;
  extraBranchPriceMinor: number;
  moduleKeys: ModuleKey[];
};

// Faz 13 Adım 0: pazarlama ana sayfasının fiyatlandırma bölümü — plans +
// plan_modules ikisi de herkese açık okunur (0038/0073), listPlatformPlans
// (src/lib/data/platformPlans.ts) ile aynı join deseninin service-role
// gerektirmeyen halka-açık hali.
export async function getMarketingPlans(): Promise<MarketingPlan[]> {
  const supabase = await createClient();
  const [{ data: plans }, { data: planModules }] = await Promise.all([
    supabase
      .from("plans")
      .select("id, key, name, price_minor, table_limit, included_branch_count, extra_branch_price_minor")
      .order("price_minor"),
    supabase.from("plan_modules").select("plan_id, module_key"),
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
    moduleKeys: moduleKeysByPlan.get(p.id) ?? [],
  }));
}
