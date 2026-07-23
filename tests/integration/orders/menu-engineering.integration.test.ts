import { afterAll, describe, expect, it } from "vitest";

import { createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function setupTenant(prefix: string) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();
  await service.from("tenant_modules").insert([
    { tenant_id: tenant.tenantId, module_key: "inventory", is_enabled: true },
    { tenant_id: tenant.tenantId, module_key: "recipes", is_enabled: true },
  ]);
  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, owner };
}

async function createIngredient(tenantId: string, avgCostMinorPerUnit: number, currentStock = 100000) {
  const service = serviceRoleClient();
  const { data } = await service
    .from("ingredients")
    .insert({ tenant_id: tenantId, name: `ing-${crypto.randomUUID().slice(0, 6)}`, unit: "g", current_stock: currentStock, avg_cost_minor_per_unit: avgCostMinorPerUnit })
    .select("id")
    .single();
  return data!.id as string;
}

async function createProduct(tenantId: string, basePriceMinor: number) {
  const service = serviceRoleClient();
  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "recipe", base_price_minor: basePriceMinor, display_order: 0 });
  return productId;
}

// Sabit bir tarih kullanılır (gerçek "bugün" yerine) — RPC created_at'i
// tenant saat dilimine çevirip filtreler (bkz. 0056'nın aynı deseni);
// gerçek zamanlı "bugün" UTC 21:00-24:00 arasında (İstanbul UTC+3 için)
// tenant-local tarihle uyuşmayabilir (bkz. TESTING.md §7, Faz 7 açığı).
// Sabit tarih + created_at'i öğlen UTC'ye ayarlamak bu sınıfı tamamen ortadan kaldırır.
const TEST_DATE = "2026-06-15";

describe("recompute_product_cost / recompute_costs_for_ingredient (Faz 8 Adım 3, S37)", () => {
  it("saveRecipe sonrası ürün-seviyesi reçeteden otomatik maliyet hesaplanır", async () => {
    const { tenantId, owner } = await setupTenant("cost-recipe");
    const productId = await createProduct(tenantId, 5000);
    const ingredientId = await createIngredient(tenantId, 200); // 200 kuruş/g

    const { data: recipe } = await owner.from("recipes").insert({ tenant_id: tenantId, product_id: productId, variant_id: null }).select("id").single();
    await owner.from("recipe_items").insert({ tenant_id: tenantId, recipe_id: recipe!.id, ingredient_id: ingredientId, quantity_per_unit: 30 });

    const { error } = await owner.rpc("recompute_product_cost", { p_product_id: productId });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: cost } = await service.from("product_costs").select("cost_minor").eq("product_id", productId).single();
    expect(cost?.cost_minor).toBe(30 * 200); // 6000
  });

  it("bir malzemenin ortalama maliyeti değişince onu kullanan ürünlerin maliyeti otomatik güncellenir", async () => {
    const { tenantId, owner } = await setupTenant("cost-ingredient-change");
    const productId = await createProduct(tenantId, 5000);
    const ingredientId = await createIngredient(tenantId, 100, 100);
    const service = serviceRoleClient();
    const { data: recipe } = await service.from("recipes").insert({ tenant_id: tenantId, product_id: productId, variant_id: null }).select("id").single();
    await service.from("recipe_items").insert({ tenant_id: tenantId, recipe_id: recipe!.id, ingredient_id: ingredientId, quantity_per_unit: 10 });
    await owner.rpc("recompute_product_cost", { p_product_id: productId });

    const { data: before } = await service.from("product_costs").select("cost_minor").eq("product_id", productId).single();
    expect(before?.cost_minor).toBe(1000); // 10*100

    // Alım girişi ortalama maliyeti değiştirir (100g @100 mevcut, +100g @300 alınır -> ortalama 200)
    await owner.rpc("record_purchase", { p_ingredient_id: ingredientId, p_quantity: 100, p_unit_cost_minor: 300 });

    const { data: after } = await service.from("product_costs").select("cost_minor").eq("product_id", productId).single();
    expect(after?.cost_minor).toBe(2000); // 10*200
  });

  it("yalnızca varyanta özel reçetesi olan ürün otomatik maliyetlenmez", async () => {
    const { tenantId, owner } = await setupTenant("cost-variant-only");
    const productId = await createProduct(tenantId, 5000);
    const service = serviceRoleClient();
    const { data: variant } = await service.from("product_variants").insert({ tenant_id: tenantId, product_id: productId, price_minor: 6000, display_order: 0 }).select("id").single();
    const ingredientId = await createIngredient(tenantId, 100);
    const { data: recipe } = await service.from("recipes").insert({ tenant_id: tenantId, product_id: productId, variant_id: variant!.id }).select("id").single();
    await service.from("recipe_items").insert({ tenant_id: tenantId, recipe_id: recipe!.id, ingredient_id: ingredientId, quantity_per_unit: 10 });

    const { error } = await owner.rpc("recompute_product_cost", { p_product_id: productId });
    expect(error).toBeNull();

    const { data: cost } = await service.from("product_costs").select("cost_minor").eq("product_id", productId).maybeSingle();
    expect(cost).toBeNull();
  });
});

describe("get_menu_engineering_matrix (Faz 8 Adım 3, S37)", () => {
  it("popülerlik ve marja göre doğru kategoriye ayırır", async () => {
    const { tenantId, branchId, owner } = await setupTenant("menu-eng-matrix");
    const service = serviceRoleClient();

    // Star: yüksek satış + yüksek marj (ucuz maliyet, yüksek fiyat, çok satan)
    const starProductId = await createProduct(tenantId, 10000);
    await service.from("product_costs").insert({ product_id: starProductId, tenant_id: tenantId, cost_minor: 1000 });
    // Dog: düşük satış + düşük marj (pahalı maliyet, düşük fiyat, az satan)
    const dogProductId = await createProduct(tenantId, 2000);
    await service.from("product_costs").insert({ product_id: dogProductId, tenant_id: tenantId, cost_minor: 1800 });

    const { data: table } = await service.from("tables").select("id").eq("tenant_id", tenantId).eq("branch_id", branchId).eq("is_counter", true).single();

    async function placeOrder(productId: string, quantity: number, unitPrice: number) {
      const orderId = crypto.randomUUID();
      const { data: session } = await service.from("table_sessions").select("id").eq("table_id", table!.id).eq("status", "active").maybeSingle();
      let tableSessionId = session?.id as string | undefined;
      if (!tableSessionId) {
        const { data: newSession } = await service.from("table_sessions").insert({ tenant_id: tenantId, branch_id: branchId, table_id: table!.id, status: "active" }).select("id").single();
        tableSessionId = newSession!.id;
      }
      await service.from("orders").insert({
        id: orderId, tenant_id: tenantId, branch_id: branchId, table_session_id: tableSessionId,
        status: "approved", subtotal_minor: unitPrice * quantity, channel: "dine_in", idempotency_key: crypto.randomUUID(),
      });
      await service.from("order_items").insert({
        tenant_id: tenantId, branch_id: branchId, table_session_id: tableSessionId, order_id: orderId, product_id: productId,
        product_name_snapshot: productId === starProductId ? "Yıldız Ürün" : "Zayıf Ürün",
        unit_price_minor: unitPrice, quantity, line_subtotal_minor: unitPrice * quantity,
        created_at: `${TEST_DATE}T12:00:00Z`,
      });
    }

    await placeOrder(starProductId, 20, 10000);
    await placeOrder(dogProductId, 2, 2000);

    const { data, error } = await owner.rpc("get_menu_engineering_matrix", { p_branch_id: branchId, p_start_date: TEST_DATE, p_end_date: TEST_DATE });
    expect(error).toBeNull();
    expect(data).toHaveLength(2);

    const star = data!.find((r) => r.product_name === "Yıldız Ürün");
    const dog = data!.find((r) => r.product_name === "Zayıf Ürün");
    expect(star?.category).toBe("star");
    expect(dog?.category).toBe("dog");
  });

  it("reports.profit izni olmayan personel raporu okuyamaz", async () => {
    const { tenantId, branchId } = await setupTenant("menu-eng-perm");
    const service = serviceRoleClient();
    const waiterEmail = `waiter-${crypto.randomUUID().slice(0, 8)}@test-throwaway.test`;
    const { data: authUser } = await service.auth.admin.createUser({ email: waiterEmail, password: "password123", email_confirm: true });
    await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "waiter", is_active: true });
    const waiter = await signInAsSeededOwner(waiterEmail);

    const { error } = await waiter.rpc("get_menu_engineering_matrix", { p_branch_id: branchId, p_start_date: TEST_DATE, p_end_date: TEST_DATE });
    expect(error).not.toBeNull();
  });
});
