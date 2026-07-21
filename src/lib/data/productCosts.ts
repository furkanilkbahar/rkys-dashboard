import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ProductWithCost = {
  productId: string;
  name: string;
  basePriceMinor: number;
  costMinor: number | null;
};

export async function getProductsWithCosts(tenantId: string): Promise<ProductWithCost[]> {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, base_price_minor, display_order")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("display_order");

  if (!products || products.length === 0) {
    return [];
  }

  const [{ data: translations }, { data: costs }] = await Promise.all([
    supabase
      .from("content_translations")
      .select("entity_id, value")
      .eq("tenant_id", tenantId)
      .eq("entity_type", "product")
      .eq("field", "name")
      .eq("locale", "tr")
      .in(
        "entity_id",
        products.map((p) => p.id),
      ),
    supabase
      .from("product_costs")
      .select("product_id, cost_minor")
      .eq("tenant_id", tenantId)
      .in(
        "product_id",
        products.map((p) => p.id),
      ),
  ]);

  const nameMap = new Map((translations ?? []).map((t) => [t.entity_id, t.value]));
  const costMap = new Map((costs ?? []).map((c) => [c.product_id, c.cost_minor]));

  return products.map((p) => ({
    productId: p.id,
    name: nameMap.get(p.id) ?? "?",
    basePriceMinor: p.base_price_minor,
    costMinor: costMap.get(p.id) ?? null,
  }));
}
