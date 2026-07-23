import { afterAll, describe, expect, it } from "vitest";

import { bootstrapGuestForTable, createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();
const openedSessionIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of openedSessionIds) {
    await service.from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id);
  }
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function setupTenant(prefix: string, recipesEnabled = true) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();

  await service.from("tenant_modules").insert([
    { tenant_id: tenant.tenantId, module_key: "pos_cash", is_enabled: true },
    { tenant_id: tenant.tenantId, module_key: "inventory", is_enabled: true },
    { tenant_id: tenant.tenantId, module_key: "recipes", is_enabled: recipesEnabled },
  ]);

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenant.tenantId, layout: "grid", display_order: 0 });
  await service
    .from("products")
    .insert({ id: productId, tenant_id: tenant.tenantId, category_id: categoryId, track_mode: "recipe", base_price_minor: 5000, display_order: 0 });

  const { data: counterTable } = await service
    .from("tables")
    .select("id")
    .eq("tenant_id", tenant.tenantId)
    .eq("branch_id", tenant.branchId)
    .eq("is_counter", true)
    .single();

  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, productId, counterTableId: counterTable!.id as string, owner };
}

async function createIngredient(tenantId: string, currentStock: number, avgCostMinorPerUnit = 100) {
  const service = serviceRoleClient();
  const { data } = await service
    .from("ingredients")
    .insert({ tenant_id: tenantId, name: `ing-${crypto.randomUUID().slice(0, 6)}`, unit: "g", current_stock: currentStock, avg_cost_minor_per_unit: avgCostMinorPerUnit })
    .select("id")
    .single();
  return data!.id as string;
}

async function createRecipe(tenantId: string, productId: string, variantId: string | null, items: { ingredientId: string; quantityPerUnit: number }[]) {
  const service = serviceRoleClient();
  const { data: recipe } = await service.from("recipes").insert({ tenant_id: tenantId, product_id: productId, variant_id: variantId }).select("id").single();
  await service.from("recipe_items").insert(
    items.map((item) => ({ tenant_id: tenantId, recipe_id: recipe!.id, ingredient_id: item.ingredientId, quantity_per_unit: item.quantityPerUnit })),
  );
  return recipe!.id as string;
}

describe("Reçeteden stok düşümü (Faz 8 Adım 0, S34)", () => {
  it("submit_staff_order ile reçeteli ürün satılınca malzeme stoğu doğru düşer, ledger'a satır yazılır", async () => {
    const { tenantId, productId, counterTableId, owner } = await setupTenant("recipe-deduct");
    const ingredientId = await createIngredient(tenantId, 1000);
    await createRecipe(tenantId, productId, null, [{ ingredientId, quantityPerUnit: 50 }]);

    const { error } = await owner.rpc("submit_staff_order", {
      p_table_id: counterTableId,
      p_items: [{ productId, variantId: null, quantity: 3, extraIds: [] }],
    });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: ingredient } = await service.from("ingredients").select("current_stock").eq("id", ingredientId).single();
    expect(ingredient?.current_stock).toBe(1000 - 50 * 3);

    const { data: movements } = await service.from("stock_movements").select("type, quantity_delta").eq("ingredient_id", ingredientId);
    expect(movements).toHaveLength(1);
    expect(movements![0]).toEqual({ type: "sale_deduction", quantity_delta: -150 });
  });

  it("reçetesi olmayan reçete-modlu ürün satışı düşüm yapmadan sessizce başarılı olur", async () => {
    const { productId, counterTableId, owner } = await setupTenant("recipe-no-recipe");

    const { error } = await owner.rpc("submit_staff_order", {
      p_table_id: counterTableId,
      p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }],
    });
    expect(error).toBeNull();
  });

  it("recipes modülü kapalıyken reçete-modlu ürün satışı düşüm yapmaz", async () => {
    const { tenantId, productId, counterTableId, owner } = await setupTenant("recipe-disabled", false);
    const ingredientId = await createIngredient(tenantId, 1000);
    await createRecipe(tenantId, productId, null, [{ ingredientId, quantityPerUnit: 50 }]);

    const { error } = await owner.rpc("submit_staff_order", {
      p_table_id: counterTableId,
      p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }],
    });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: ingredient } = await service.from("ingredients").select("current_stock").eq("id", ingredientId).single();
    expect(ingredient?.current_stock).toBe(1000);
  });

  it("varyant-spesifik reçete, ürün-seviyesi reçeteye tercih edilir", async () => {
    const { tenantId, productId, counterTableId, owner } = await setupTenant("recipe-variant-priority");
    const service = serviceRoleClient();
    const { data: variant } = await service
      .from("product_variants")
      .insert({ tenant_id: tenantId, product_id: productId, price_minor: 6000, display_order: 0 })
      .select("id")
      .single();

    const productIngredientId = await createIngredient(tenantId, 1000);
    const variantIngredientId = await createIngredient(tenantId, 1000);
    await createRecipe(tenantId, productId, null, [{ ingredientId: productIngredientId, quantityPerUnit: 10 }]);
    await createRecipe(tenantId, productId, variant!.id, [{ ingredientId: variantIngredientId, quantityPerUnit: 20 }]);

    const { error } = await owner.rpc("submit_staff_order", {
      p_table_id: counterTableId,
      p_items: [{ productId, variantId: variant!.id, quantity: 2, extraIds: [] }],
    });
    expect(error).toBeNull();

    const { data: productIngredient } = await service.from("ingredients").select("current_stock").eq("id", productIngredientId).single();
    const { data: variantIngredient } = await service.from("ingredients").select("current_stock").eq("id", variantIngredientId).single();
    expect(productIngredient?.current_stock).toBe(1000); // düşülmedi
    expect(variantIngredient?.current_stock).toBe(1000 - 20 * 2); // düşüldü
  });

  it("misafir submit_order akışında da reçete düşümü çalışır", async () => {
    const tenant = await createThrowawayTenant("recipe-guest");
    cleanupTenantIds.add(tenant.tenantId);
    const service = serviceRoleClient();
    await service.from("tenant_modules").insert([
      { tenant_id: tenant.tenantId, module_key: "inventory", is_enabled: true },
      { tenant_id: tenant.tenantId, module_key: "recipes", is_enabled: true },
    ]);

    const categoryId = crypto.randomUUID();
    const productId = crypto.randomUUID();
    await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenant.tenantId, layout: "grid", display_order: 0 });
    await service
      .from("products")
      .insert({ id: productId, tenant_id: tenant.tenantId, category_id: categoryId, track_mode: "recipe", base_price_minor: 3000, display_order: 0 });

    const tableId = crypto.randomUUID();
    await service.from("tables").insert({
      id: tableId,
      tenant_id: tenant.tenantId,
      branch_id: tenant.branchId,
      label: "Masa 1",
      qr_token_hash: crypto.randomUUID(),
    });

    const ingredientId = await createIngredient(tenant.tenantId, 500);
    await createRecipe(tenant.tenantId, productId, null, [{ ingredientId, quantityPerUnit: 25 }]);

    const { client, tableSessionId } = await bootstrapGuestForTable(tableId);
    openedSessionIds.add(tableSessionId);

    const { error } = await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId, variantId: null, quantity: 4, extraIds: [] }],
    });
    expect(error).toBeNull();

    const { data: ingredient } = await service.from("ingredients").select("current_stock").eq("id", ingredientId).single();
    expect(ingredient?.current_stock).toBe(500 - 25 * 4);
  });
});
