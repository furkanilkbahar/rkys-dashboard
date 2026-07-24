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
    { tenant_id: tenant.tenantId, module_key: "pos_cash", is_enabled: true },
    { tenant_id: tenant.tenantId, module_key: "accounting_export", is_enabled: true },
  ]);
  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, owner };
}

async function createServedOrder(tenantId: string, branchId: string, owner: Awaited<ReturnType<typeof signInAsSeededOwner>>) {
  const service = serviceRoleClient();
  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 2000, display_order: 0 });
  const { data: counterTable } = await service.from("tables").select("id").eq("tenant_id", tenantId).eq("branch_id", branchId).eq("is_counter", true).single();
  const { data: order } = await owner.rpc("submit_staff_order", { p_table_id: counterTable!.id, p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }] });
  const orderId = order![0].order_id as string;
  await service.from("orders").update({ status: "served" }).eq("id", orderId);
  return orderId;
}

describe("accounting_sync_log RLS izolasyonu (Faz 10 Adım 3, S44)", () => {
  it("personel kendi tenant'ının senkronizasyon kaydını görebilir, ekleyebilir", async () => {
    const { tenantId, branchId, owner } = await setupTenant("accounting-rls-own");
    const orderId = await createServedOrder(tenantId, branchId, owner);

    const { error: insertError } = await owner
      .from("accounting_sync_log")
      .insert({ tenant_id: tenantId, order_id: orderId, provider: "mock", status: "success", external_ref: "mock-inv-1" });
    expect(insertError).toBeNull();

    const { data } = await owner.from("accounting_sync_log").select("id, status").eq("order_id", orderId);
    expect(data).toHaveLength(1);
  });

  it("A tenant'ının personeli B tenant'ının senkronizasyon kaydını göremez", async () => {
    const { tenantId: tenantAId, branchId: branchAId, owner: ownerA } = await setupTenant("accounting-rls-a");
    const { owner: ownerB } = await setupTenant("accounting-rls-b");
    const orderId = await createServedOrder(tenantAId, branchAId, ownerA);
    const service = serviceRoleClient();
    await service.from("accounting_sync_log").insert({ tenant_id: tenantAId, order_id: orderId, provider: "mock", status: "success", external_ref: "mock-inv-2" });

    const { data } = await ownerB.from("accounting_sync_log").select("id").eq("order_id", orderId);
    expect(data).toHaveLength(0);
  });

  it("B tenant'ının personeli A tenant'ı adına sahte bir senkronizasyon kaydı ekleyemez", async () => {
    const { tenantId: tenantAId, branchId: branchAId, owner: ownerA } = await setupTenant("accounting-rls-forge-a");
    const { owner: ownerB } = await setupTenant("accounting-rls-forge-b");
    const orderId = await createServedOrder(tenantAId, branchAId, ownerA);

    const { error } = await ownerB
      .from("accounting_sync_log")
      .insert({ tenant_id: tenantAId, order_id: orderId, provider: "mock", status: "success", external_ref: "forged" });
    expect(error).not.toBeNull();
  });
});
