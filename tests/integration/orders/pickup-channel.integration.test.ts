import { afterAll, describe, expect, it } from "vitest";

import { bootstrapGuestForPickup, createThrowawayTenant, serviceRoleClient } from "../../helpers/testClients";

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

async function setupTenant(prefix: string, pickupEnabled = true) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();
  await service.from("tenant_modules").insert({ tenant_id: tenant.tenantId, module_key: "pickup", is_enabled: pickupEnabled });

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenant.tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenant.tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 4000, display_order: 0 });

  return { ...tenant, productId };
}

describe("Gel-Al (pickup) kanalı (Faz 9 Adım 0, S38)", () => {
  it("open_pickup_session table_id=null, channel='pickup' bir oturum açar ve teslim kodu üretir", async () => {
    const { tenantId } = await setupTenant("pickup-open");
    const { tableSessionId, pickupCode } = await bootstrapGuestForPickup(tenantId);
    openedSessionIds.add(tableSessionId);

    expect(pickupCode).toMatch(/^[A-Z0-9]{6}$/);

    const service = serviceRoleClient();
    const { data: session } = await service.from("table_sessions").select("table_id, channel, pickup_code, status").eq("id", tableSessionId).single();
    expect(session).toEqual({ table_id: null, channel: "pickup", pickup_code: pickupCode, status: "active" });
  });

  it("pickup modülü kapalıyken oturum açılamaz", async () => {
    const { tenantId } = await setupTenant("pickup-disabled", false);
    const service = serviceRoleClient();
    const { error } = await service.rpc("open_pickup_session", { p_tenant_id: tenantId });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("pickup module not enabled");
  });

  it("aynı tenant için her çağrı yeni bir oturum açar (dine_in'in tek-aktif-oturum kısıtı uygulanmaz)", async () => {
    const { tenantId } = await setupTenant("pickup-multi");
    const first = await bootstrapGuestForPickup(tenantId);
    const second = await bootstrapGuestForPickup(tenantId);
    openedSessionIds.add(first.tableSessionId);
    openedSessionIds.add(second.tableSessionId);

    expect(first.tableSessionId).not.toBe(second.tableSessionId);
  });

  it("submit_order pickup oturumunda channel='pickup' ile sipariş oluşturur", async () => {
    const { tenantId, productId } = await setupTenant("pickup-submit-order");
    const { client, tableSessionId } = await bootstrapGuestForPickup(tenantId);
    openedSessionIds.add(tableSessionId);

    const { data, error } = await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId, variantId: null, quantity: 2, extraIds: [] }],
    });
    expect(error).toBeNull();
    expect(data?.[0].subtotal_minor).toBe(8000);

    const service = serviceRoleClient();
    const { data: order } = await service.from("orders").select("channel").eq("id", data![0].order_id).single();
    expect(order?.channel).toBe("pickup");
  });

  it("misafirin mevcut oturum RLS/RPC zinciri (submit_order, guest select) pickup için de değişmeden çalışır", async () => {
    const { tenantId, productId } = await setupTenant("pickup-rls");
    const { client, tableSessionId } = await bootstrapGuestForPickup(tenantId);
    openedSessionIds.add(tableSessionId);

    await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }],
    });

    const { data: ownOrders, error } = await client.from("orders").select("id").eq("table_session_id", tableSessionId);
    expect(error).toBeNull();
    expect(ownOrders).toHaveLength(1);
  });
});
