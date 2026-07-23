import { afterAll, describe, expect, it } from "vitest";

import { createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function setupTenant(prefix: string, inventoryEnabled = true) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();
  await service.from("tenant_modules").insert({ tenant_id: tenant.tenantId, module_key: "inventory", is_enabled: inventoryEnabled });
  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, owner };
}

async function createIngredient(tenantId: string, currentStock: number, avgCostMinorPerUnit: number) {
  const service = serviceRoleClient();
  const { data } = await service
    .from("ingredients")
    .insert({ tenant_id: tenantId, name: `ing-${crypto.randomUUID().slice(0, 6)}`, unit: "g", current_stock: currentStock, avg_cost_minor_per_unit: avgCostMinorPerUnit })
    .select("id")
    .single();
  return data!.id as string;
}

describe("Tedarik: basit alım girişi + hareketli ortalama maliyet (Faz 8 Adım 1, S35)", () => {
  it("alım girişi stoğu artırır ve hareketli ortalama maliyeti doğru hesaplar", async () => {
    const { tenantId, owner } = await setupTenant("purchase-avg-cost");
    const ingredientId = await createIngredient(tenantId, 100, 200); // 100g @ 200 kuruş/g

    const { error } = await owner.rpc("record_purchase", { p_ingredient_id: ingredientId, p_quantity: 100, p_unit_cost_minor: 400 }); // +100g @ 400 kuruş/g
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: ingredient } = await service.from("ingredients").select("current_stock, avg_cost_minor_per_unit").eq("id", ingredientId).single();
    expect(ingredient?.current_stock).toBe(200);
    // (100*200 + 100*400) / 200 = 300
    expect(ingredient?.avg_cost_minor_per_unit).toBe(300);

    const { data: purchases } = await service.from("purchases").select("quantity, unit_cost_minor").eq("ingredient_id", ingredientId);
    expect(purchases).toHaveLength(1);
    expect(purchases![0]).toEqual({ quantity: 100, unit_cost_minor: 400 });

    const { data: movements } = await service.from("stock_movements").select("type, quantity_delta, unit_cost_minor_snapshot").eq("ingredient_id", ingredientId);
    expect(movements).toHaveLength(1);
    expect(movements![0]).toEqual({ type: "purchase", quantity_delta: 100, unit_cost_minor_snapshot: 400 });
  });

  it("tedarikçi belirtilerek alım girişi yapılabilir", async () => {
    const { tenantId, owner } = await setupTenant("purchase-supplier");
    const ingredientId = await createIngredient(tenantId, 0, 0);
    const service = serviceRoleClient();
    const { data: supplier } = await service.from("suppliers").insert({ tenant_id: tenantId, name: "Tedarikçi A" }).select("id").single();

    const { error } = await owner.rpc("record_purchase", {
      p_ingredient_id: ingredientId,
      p_supplier_id: supplier!.id,
      p_quantity: 50,
      p_unit_cost_minor: 150,
    });
    expect(error).toBeNull();

    const { data: purchase } = await service.from("purchases").select("supplier_id").eq("ingredient_id", ingredientId).single();
    expect(purchase?.supplier_id).toBe(supplier!.id);
  });

  it("negatif/sıfır stoktan alım sonrası ortalama maliyet doğrudan alım fiyatına sıfırlanır", async () => {
    const { tenantId, owner } = await setupTenant("purchase-negative-reset");
    const ingredientId = await createIngredient(tenantId, -50, 1000); // önceki reçete düşümleri stoğu negatife itmiş

    const { error } = await owner.rpc("record_purchase", { p_ingredient_id: ingredientId, p_quantity: 30, p_unit_cost_minor: 500 });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: ingredient } = await service.from("ingredients").select("current_stock, avg_cost_minor_per_unit").eq("id", ingredientId).single();
    expect(ingredient?.current_stock).toBe(-20);
    expect(ingredient?.avg_cost_minor_per_unit).toBe(500);
  });

  it("inventory modülü kapalıyken alım girişi reddedilir", async () => {
    const { tenantId, owner } = await setupTenant("purchase-disabled", false);
    const ingredientId = await createIngredient(tenantId, 0, 0);

    const { error } = await owner.rpc("record_purchase", { p_ingredient_id: ingredientId, p_quantity: 10, p_unit_cost_minor: 100 });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("inventory module not enabled");
  });

  it("başka tenant'ın malzemesine alım girişi reddedilir", async () => {
    const { tenantId: tenantAId } = await setupTenant("purchase-rls-a");
    const { owner: ownerB } = await setupTenant("purchase-rls-b");
    const ingredientId = await createIngredient(tenantAId, 0, 0);

    const { error } = await ownerB.rpc("record_purchase", { p_ingredient_id: ingredientId, p_quantity: 10, p_unit_cost_minor: 100 });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("invalid ingredient");
  });
});
