"use server";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import { ingredientFormSchema, recipeFormSchema, type InventoryActionResult } from "@/lib/inventory/schemas";
import { isEnabled } from "@/lib/modules/isEnabled";
import { createClient } from "@/lib/supabase/server";

export async function createIngredient(input: unknown): Promise<InventoryActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (!(await isEnabled(actor.tenantId, "inventory"))) return { ok: false, error: "not_enabled" };

  const parsed = ingredientFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.from("ingredients").insert({
    tenant_id: actor.tenantId,
    name: parsed.data.name,
    unit: parsed.data.unit,
    critical_level: parsed.data.criticalLevel,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/ingredients");
  return { ok: true };
}

export async function updateIngredient(ingredientId: string, input: unknown): Promise<InventoryActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = ingredientFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ingredients")
    .update({ name: parsed.data.name, unit: parsed.data.unit, critical_level: parsed.data.criticalLevel, updated_at: new Date().toISOString() })
    .eq("id", ingredientId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/ingredients");
  return { ok: true };
}

// saveRecipe: (product_id, variant_id) reçetesini tamamen değiştirir —
// mevcut recipe_items silinip yeni set eklenir (basit "replace" yaklaşımı,
// recipe_items sayısı düşük olduğu için diff'lemeye gerek yok).
export async function saveRecipe(input: unknown): Promise<InventoryActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (!(await isEnabled(actor.tenantId, "recipes"))) return { ok: false, error: "not_enabled" };

  const parsed = recipeFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();

  let existingQuery = supabase
    .from("recipes")
    .select("id")
    .eq("tenant_id", actor.tenantId)
    .eq("product_id", parsed.data.productId);
  existingQuery = parsed.data.variantId
    ? existingQuery.eq("variant_id", parsed.data.variantId)
    : existingQuery.is("variant_id", null);
  const { data: existing } = await existingQuery.maybeSingle();

  let recipeId = existing?.id as string | undefined;
  if (!recipeId) {
    const { data: created, error: createError } = await supabase
      .from("recipes")
      .insert({ tenant_id: actor.tenantId, product_id: parsed.data.productId, variant_id: parsed.data.variantId })
      .select("id")
      .single();
    if (createError || !created) return { ok: false, error: "unknown" };
    recipeId = created.id;
  } else {
    await supabase.from("recipe_items").delete().eq("recipe_id", recipeId);
  }

  const { error: itemsError } = await supabase.from("recipe_items").insert(
    parsed.data.items.map((item) => ({
      tenant_id: actor.tenantId,
      recipe_id: recipeId,
      ingredient_id: item.ingredientId,
      quantity_per_unit: item.quantityPerUnit,
    })),
  );
  if (itemsError) return { ok: false, error: "unknown" };

  revalidatePath(`/admin/ingredients/recipes/${parsed.data.productId}`);
  return { ok: true };
}
