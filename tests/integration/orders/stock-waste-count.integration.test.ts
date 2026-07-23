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

async function createIngredient(tenantId: string, currentStock: number, avgCostMinorPerUnit = 100) {
  const service = serviceRoleClient();
  const { data } = await service
    .from("ingredients")
    .insert({ tenant_id: tenantId, name: `ing-${crypto.randomUUID().slice(0, 6)}`, unit: "g", current_stock: currentStock, avg_cost_minor_per_unit: avgCostMinorPerUnit })
    .select("id")
    .single();
  return data!.id as string;
}

describe("Fire kaydı (Faz 8 Adım 2, S36)", () => {
  it("fire miktarı stoktan düşer, ledger'a not ile yazılır", async () => {
    const { tenantId, owner } = await setupTenant("waste-record");
    const ingredientId = await createIngredient(tenantId, 500, 200);

    const { error } = await owner.rpc("record_stock_waste", { p_ingredient_id: ingredientId, p_quantity: 50, p_note: "kırıldı" });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: ingredient } = await service.from("ingredients").select("current_stock").eq("id", ingredientId).single();
    expect(ingredient?.current_stock).toBe(450);

    const { data: movements } = await service.from("stock_movements").select("type, quantity_delta, note").eq("ingredient_id", ingredientId);
    expect(movements).toHaveLength(1);
    expect(movements![0]).toEqual({ type: "waste", quantity_delta: -50, note: "kırıldı" });
  });

  it("inventory modülü kapalıyken fire kaydı reddedilir", async () => {
    const { tenantId, owner } = await setupTenant("waste-disabled", false);
    const ingredientId = await createIngredient(tenantId, 500);

    const { error } = await owner.rpc("record_stock_waste", { p_ingredient_id: ingredientId, p_quantity: 10 });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("inventory module not enabled");
  });
});

describe("Sayım kaydı (Faz 8 Adım 2, S36)", () => {
  it("sayılan miktar stoğu doğrudan eşitler, fark ledger'a yazılır", async () => {
    const { tenantId, owner } = await setupTenant("count-record");
    const ingredientId = await createIngredient(tenantId, 500, 200);

    const { error } = await owner.rpc("record_stock_count", { p_ingredient_id: ingredientId, p_counted_quantity: 470 });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: ingredient } = await service.from("ingredients").select("current_stock").eq("id", ingredientId).single();
    expect(ingredient?.current_stock).toBe(470);

    const { data: movements } = await service.from("stock_movements").select("type, quantity_delta").eq("ingredient_id", ingredientId);
    expect(movements).toHaveLength(1);
    expect(movements![0]).toEqual({ type: "count_adjustment", quantity_delta: -30 });
  });

  it("sayılan miktar mevcut stokla aynıysa ledger'a satır yazılmaz", async () => {
    const { tenantId, owner } = await setupTenant("count-noop");
    const ingredientId = await createIngredient(tenantId, 100);

    const { error } = await owner.rpc("record_stock_count", { p_ingredient_id: ingredientId, p_counted_quantity: 100 });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: movements } = await service.from("stock_movements").select("id").eq("ingredient_id", ingredientId);
    expect(movements).toHaveLength(0);
  });

  it("pozitif fark (fazla çıkan stok) da doğru işlenir", async () => {
    const { tenantId, owner } = await setupTenant("count-positive");
    const ingredientId = await createIngredient(tenantId, 100);

    const { error } = await owner.rpc("record_stock_count", { p_ingredient_id: ingredientId, p_counted_quantity: 130 });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: movements } = await service.from("stock_movements").select("quantity_delta").eq("ingredient_id", ingredientId);
    expect(movements![0].quantity_delta).toBe(30);
  });
});
