import "server-only";

import type { CampaignRuleType } from "@/lib/campaigns/schemas";
import { createClient } from "@/lib/supabase/server";

export type AdminCampaign = {
  id: string;
  name: string;
  ruleType: CampaignRuleType;
  ruleConfig: Record<string, unknown>;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

export async function getAdminCampaigns(tenantId: string): Promise<AdminCampaign[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("id, name, rule_type, rule_config, starts_at, ends_at, is_active")
    .eq("tenant_id", tenantId)
    .order("created_at");

  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    ruleType: c.rule_type as CampaignRuleType,
    ruleConfig: (c.rule_config ?? {}) as Record<string, unknown>,
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    isActive: c.is_active,
  }));
}

export type ProductOption = { id: string; name: string };

// bogo kuralı için ürün seçici — call_types/reasonCodes ile aynı desen
// (content_translations lookup, tenant genelinde tüm kategoriler).
export async function getAdminProductOptions(tenantId: string, locale: string): Promise<ProductOption[]> {
  const supabase = await createClient();
  const [productsRes, translationsRes] = await Promise.all([
    supabase.from("products").select("id").eq("tenant_id", tenantId).eq("is_active", true),
    supabase
      .from("content_translations")
      .select("entity_id, value")
      .eq("tenant_id", tenantId)
      .eq("entity_type", "product")
      .eq("field", "name")
      .eq("locale", locale),
  ]);
  const nameMap = new Map((translationsRes.data ?? []).map((row) => [row.entity_id, row.value]));
  return (productsRes.data ?? []).map((p) => ({ id: p.id, name: nameMap.get(p.id) ?? p.id }));
}

export type AdminCoupon = {
  id: string;
  campaignId: string;
  campaignName: string;
  code: string;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
};

export async function getAdminCoupons(tenantId: string): Promise<AdminCoupon[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coupons")
    .select("id, campaign_id, code, usage_limit, used_count, is_active, campaigns(name)")
    .eq("tenant_id", tenantId)
    .order("created_at");

  return (data ?? []).map((c) => ({
    id: c.id,
    campaignId: c.campaign_id,
    campaignName: c.campaigns?.name ?? "?",
    code: c.code,
    usageLimit: c.usage_limit,
    usedCount: c.used_count,
    isActive: c.is_active,
  }));
}
