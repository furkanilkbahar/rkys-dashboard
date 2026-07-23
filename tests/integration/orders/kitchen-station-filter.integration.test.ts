import { afterAll, describe, expect, it } from "vitest";

import { createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

// getOrdersByStatus (lib/data/staffOrders.ts) Next.js SSR cookie'lerine bağlı
// createClient() kullanır, bu yüzden Vitest'ten doğrudan çağrılamaz (diğer
// entegrasyon testleriyle aynı kısıt) — aynı sorgu/filtre mantığı doğrudan
// authenticated client ile burada tekrarlanır.
async function queryOrdersByStatus(
  owner: Awaited<ReturnType<typeof signInAsSeededOwner>>,
  tenantId: string,
  branchId: string,
  station?: string,
) {
  const itemsSelect = station
    ? "order_items!inner(product_name_snapshot, quantity, products!inner(menu_categories!inner(station)))"
    : "order_items(product_name_snapshot, quantity)";

  let query = owner
    .from("orders")
    .select(`id, order_items:${itemsSelect}`)
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .in("status", ["approved", "preparing", "ready"]);

  if (station) {
    query = query.eq("order_items.products.menu_categories.station", station);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as { id: string; order_items: { product_name_snapshot: string; quantity: number }[] }[];
}

async function setupTenant(prefix: string) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();

  await service.from("tenant_modules").insert({ tenant_id: tenant.tenantId, module_key: "pos_cash", is_enabled: true });

  const grillCategoryId = crypto.randomUUID();
  const plainCategoryId = crypto.randomUUID();
  const grillProductId = crypto.randomUUID();
  const plainProductId = crypto.randomUUID();
  await service.from("menu_categories").insert([
    { id: grillCategoryId, tenant_id: tenant.tenantId, layout: "grid", display_order: 0, station: "grill" },
    { id: plainCategoryId, tenant_id: tenant.tenantId, layout: "grid", display_order: 1, station: null },
  ]);
  await service.from("products").insert([
    { id: grillProductId, tenant_id: tenant.tenantId, category_id: grillCategoryId, track_mode: "simple", base_price_minor: 5000, display_order: 0 },
    { id: plainProductId, tenant_id: tenant.tenantId, category_id: plainCategoryId, track_mode: "simple", base_price_minor: 3000, display_order: 0 },
  ]);

  const { data: counterTable } = await service
    .from("tables")
    .select("id")
    .eq("tenant_id", tenant.tenantId)
    .eq("branch_id", tenant.branchId)
    .eq("is_counter", true)
    .single();

  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, grillProductId, plainProductId, counterTableId: counterTable!.id as string, owner };
}

async function placeStaffOrder(
  owner: Awaited<ReturnType<typeof signInAsSeededOwner>>,
  counterTableId: string,
  items: { productId: string; quantity: number }[],
) {
  const { data, error } = await owner.rpc("submit_staff_order", {
    p_table_id: counterTableId,
    p_items: items.map((i) => ({ productId: i.productId, variantId: null, quantity: i.quantity, extraIds: [] })),
  });
  if (error) throw new Error(error.message);
  return data![0].order_id as string;
}

describe("Mutfak istasyon filtresi (Faz 6 Adım 3, S28)", () => {
  it("station verilmeyince tüm kalemler (istasyonlu + istasyonsuz) görünür", async () => {
    const { tenantId, branchId, counterTableId, grillProductId, plainProductId, owner } = await setupTenant("kds-no-filter");
    await placeStaffOrder(owner, counterTableId, [
      { productId: grillProductId, quantity: 1 },
      { productId: plainProductId, quantity: 1 },
    ]);

    const orders = await queryOrdersByStatus(owner, tenantId, branchId);
    expect(orders).toHaveLength(1);
    expect(orders[0].order_items).toHaveLength(2);
  });

  it("station verilince yalnızca o istasyonun kalemini içeren sipariş görünür ve kalem listesi daralır", async () => {
    const { tenantId, branchId, counterTableId, grillProductId, plainProductId, owner } = await setupTenant("kds-mixed-filter");
    await placeStaffOrder(owner, counterTableId, [
      { productId: grillProductId, quantity: 1 },
      { productId: plainProductId, quantity: 1 },
    ]);

    const orders = await queryOrdersByStatus(owner, tenantId, branchId, "grill");
    expect(orders).toHaveLength(1);
    expect(orders[0].order_items).toHaveLength(1);
    expect(orders[0].order_items[0].quantity).toBe(1);
  });

  it("station verilince o istasyondan hiç kalemi olmayan sipariş görünmez", async () => {
    const { tenantId, branchId, counterTableId, plainProductId, owner } = await setupTenant("kds-no-match");
    await placeStaffOrder(owner, counterTableId, [{ productId: plainProductId, quantity: 1 }]);

    const orders = await queryOrdersByStatus(owner, tenantId, branchId, "grill");
    expect(orders).toHaveLength(0);
  });
});
