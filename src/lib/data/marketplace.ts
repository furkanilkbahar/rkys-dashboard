import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AdminMarketplaceMapping = { id: string; provider: string; externalSku: string; productId: string; productName: string };
export type SelectableProduct = { id: string; name: string };

export async function getAdminMarketplaceMappings(tenantId: string): Promise<AdminMarketplaceMapping[]> {
  const supabase = await createClient();
  const { data: mappings } = await supabase
    .from("product_external_mappings")
    .select("id, provider, external_sku, product_id")
    .eq("tenant_id", tenantId)
    .order("provider");

  if (!mappings || mappings.length === 0) return [];

  const { data: translations } = await supabase
    .from("content_translations")
    .select("entity_id, value")
    .eq("tenant_id", tenantId)
    .eq("entity_type", "product")
    .eq("field", "name")
    .eq("locale", "tr")
    .in(
      "entity_id",
      mappings.map((m) => m.product_id),
    );
  const nameByProductId = new Map((translations ?? []).map((t) => [t.entity_id, t.value]));

  return mappings.map((m) => ({
    id: m.id,
    provider: m.provider,
    externalSku: m.external_sku,
    productId: m.product_id,
    productName: nameByProductId.get(m.product_id) ?? "",
  }));
}

export async function getSelectableProducts(tenantId: string): Promise<SelectableProduct[]> {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, display_order")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("display_order");

  if (!products || products.length === 0) return [];

  const { data: translations } = await supabase
    .from("content_translations")
    .select("entity_id, value")
    .eq("tenant_id", tenantId)
    .eq("entity_type", "product")
    .eq("field", "name")
    .eq("locale", "tr")
    .in(
      "entity_id",
      products.map((p) => p.id),
    );
  const nameByProductId = new Map((translations ?? []).map((t) => [t.entity_id, t.value]));

  return products.map((p) => ({ id: p.id, name: nameByProductId.get(p.id) ?? "" }));
}
