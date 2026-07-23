import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { IngredientUnit } from "@/lib/inventory/schemas";

export type AdminIngredient = {
  id: string;
  name: string;
  unit: IngredientUnit;
  criticalLevel: number;
  currentStock: number;
  avgCostMinorPerUnit: number;
  isActive: boolean;
};

export async function getAdminIngredients(tenantId: string): Promise<AdminIngredient[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ingredients")
    .select("id, name, unit, critical_level, current_stock, avg_cost_minor_per_unit, is_active")
    .eq("tenant_id", tenantId)
    .order("name");

  return (data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit as IngredientUnit,
    criticalLevel: i.critical_level,
    currentStock: i.current_stock,
    avgCostMinorPerUnit: i.avg_cost_minor_per_unit,
    isActive: i.is_active,
  }));
}

export type AdminRecipeVariant = { id: string | null; label: string | null };

export type AdminRecipeData = {
  productId: string;
  productName: string;
  variants: AdminRecipeVariant[];
  recipes: Record<string, { ingredientId: string; ingredientName: string; quantityPerUnit: number }[]>;
};

export async function getAdminRecipe(tenantId: string, productId: string): Promise<AdminRecipeData | null> {
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, category_id")
    .eq("tenant_id", tenantId)
    .eq("id", productId)
    .maybeSingle();
  if (!product) return null;

  const [{ data: nameTranslation }, { data: variants }, { data: recipeRows }] = await Promise.all([
    supabase
      .from("content_translations")
      .select("value")
      .eq("tenant_id", tenantId)
      .eq("entity_type", "product")
      .eq("entity_id", productId)
      .eq("field", "name")
      .eq("locale", "tr")
      .maybeSingle(),
    supabase
      .from("product_variants")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .order("display_order"),
    supabase.from("recipes").select("id, variant_id").eq("tenant_id", tenantId).eq("product_id", productId),
  ]);

  const variantIds = (variants ?? []).map((v) => v.id);
  const variantNameMap = new Map<string, string>();
  if (variantIds.length > 0) {
    const { data: variantTranslations } = await supabase
      .from("content_translations")
      .select("entity_id, value")
      .eq("tenant_id", tenantId)
      .eq("entity_type", "product_variant")
      .eq("field", "name")
      .eq("locale", "tr")
      .in("entity_id", variantIds);
    for (const t of variantTranslations ?? []) variantNameMap.set(t.entity_id, t.value);
  }

  const recipeIdByKey = new Map<string, string>();
  for (const r of recipeRows ?? []) {
    recipeIdByKey.set(r.variant_id ?? "product", r.id);
  }

  const recipeIds = [...recipeIdByKey.values()];
  const recipes: AdminRecipeData["recipes"] = {};
  if (recipeIds.length > 0) {
    const { data: items } = await supabase
      .from("recipe_items")
      .select("recipe_id, quantity_per_unit, ingredients(id, name)")
      .eq("tenant_id", tenantId)
      .in("recipe_id", recipeIds);

    const recipeIdToKey = new Map<string, string>();
    for (const [key, id] of recipeIdByKey.entries()) recipeIdToKey.set(id, key);

    for (const item of items ?? []) {
      const key = recipeIdToKey.get(item.recipe_id);
      if (!key) continue;
      const ingredient = item.ingredients as unknown as { id: string; name: string } | null;
      if (!ingredient) continue;
      if (!recipes[key]) recipes[key] = [];
      recipes[key].push({ ingredientId: ingredient.id, ingredientName: ingredient.name, quantityPerUnit: item.quantity_per_unit });
    }
  }

  return {
    productId,
    productName: nameTranslation?.value ?? "?",
    variants: [
      { id: null, label: null },
      ...(variants ?? []).map((v) => ({ id: v.id, label: variantNameMap.get(v.id) ?? "?" })),
    ],
    recipes,
  };
}
