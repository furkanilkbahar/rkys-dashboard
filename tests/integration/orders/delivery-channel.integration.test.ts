import { afterAll, describe, expect, it } from "vitest";

import { anonClient, createThrowawayTenant, serviceRoleClient } from "../../helpers/testClients";

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

async function setupTenant(prefix: string, deliveryEnabled = true) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();
  await service.from("tenant_modules").insert({ tenant_id: tenant.tenantId, module_key: "delivery", is_enabled: deliveryEnabled });

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenant.tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenant.tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 3000, display_order: 0 });

  return { ...tenant, productId };
}

async function createZone(tenantId: string, branchId: string, feeMinor: number, minBasketMinor: number) {
  const service = serviceRoleClient();
  const { data } = await service
    .from("delivery_zones")
    .insert({ tenant_id: tenantId, branch_id: branchId, name: `zone-${crypto.randomUUID().slice(0, 6)}`, fee_minor: feeMinor, min_basket_minor: minBasketMinor })
    .select("id")
    .single();
  return data!.id as string;
}

async function bootstrapDelivery(tenantId: string) {
  const service = serviceRoleClient();
  const { data: tableSessionId, error } = await service.rpc("open_delivery_session", { p_tenant_id: tenantId });
  if (error || !tableSessionId) throw new Error(`open_delivery_session failed: ${error?.message}`);

  const { data: session } = await service.from("table_sessions").select("branch_id").eq("id", tableSessionId).single();
  const guest = anonClient();
  const { data: authData } = await guest.auth.signInAnonymously();
  await service.rpc("link_guest_device", {
    p_guest_user_id: authData!.user!.id,
    p_table_session_id: tableSessionId,
    p_tenant_id: tenantId,
    p_branch_id: session!.branch_id,
  });
  await guest.auth.refreshSession();
  return { client: guest, tableSessionId: tableSessionId as string };
}

describe("Delivery kanalı (Faz 9 Adım 1, S39)", () => {
  it("open_delivery_session table_id=null, channel='delivery' bir oturum açar", async () => {
    const { tenantId } = await setupTenant("delivery-open");
    const { tableSessionId } = await bootstrapDelivery(tenantId);
    openedSessionIds.add(tableSessionId);

    const service = serviceRoleClient();
    const { data: session } = await service.from("table_sessions").select("table_id, channel, pickup_code").eq("id", tableSessionId).single();
    expect(session).toEqual({ table_id: null, channel: "delivery", pickup_code: null });
  });

  it("delivery modülü kapalıyken oturum açılamaz", async () => {
    const { tenantId } = await setupTenant("delivery-disabled", false);
    const service = serviceRoleClient();
    const { error } = await service.rpc("open_delivery_session", { p_tenant_id: tenantId });
    expect(error?.message).toContain("delivery module not enabled");
  });

  it("submit_order geçerli bölge+adresle delivery siparişi oluşturur, ücret subtotal'a eklenir", async () => {
    const { tenantId, branchId, productId } = await setupTenant("delivery-submit-ok");
    const zoneId = await createZone(tenantId, branchId, 1500, 0);
    const { client, tableSessionId } = await bootstrapDelivery(tenantId);
    openedSessionIds.add(tableSessionId);

    const { data, error } = await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }],
      p_delivery_zone_id: zoneId,
      p_delivery_address: "Örnek Mah. Test Sk. No:1",
    });
    expect(error).toBeNull();
    expect(data?.[0].subtotal_minor).toBe(4500); // 3000 + 1500 ücret

    const service = serviceRoleClient();
    const { data: order } = await service
      .from("orders")
      .select("channel, delivery_fee_minor, delivery_zone_id, delivery_address_snapshot")
      .eq("id", data![0].order_id)
      .single();
    expect(order).toEqual({
      channel: "delivery",
      delivery_fee_minor: 1500,
      delivery_zone_id: zoneId,
      delivery_address_snapshot: "Örnek Mah. Test Sk. No:1",
    });
  });

  it("minimum sepet tutarının altında sipariş reddedilir", async () => {
    const { tenantId, branchId, productId } = await setupTenant("delivery-min-basket");
    const zoneId = await createZone(tenantId, branchId, 1000, 5000);
    const { client, tableSessionId } = await bootstrapDelivery(tenantId);
    openedSessionIds.add(tableSessionId);

    const { error } = await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }],
      p_delivery_zone_id: zoneId,
      p_delivery_address: "Adres",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("MIN_BASKET_NOT_MET");
  });

  it("adres/bölge verilmeden delivery siparişi reddedilir", async () => {
    const { tenantId, productId } = await setupTenant("delivery-missing-fields");
    const { client, tableSessionId } = await bootstrapDelivery(tenantId);
    openedSessionIds.add(tableSessionId);

    const { error } = await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }],
    });
    expect(error?.message).toContain("delivery address and zone required");
  });

  it("başka tenant'ın bölgesiyle sipariş verilemez", async () => {
    const otherZoneOwner = await createThrowawayTenant("delivery-zone-owner");
    cleanupTenantIds.add(otherZoneOwner.tenantId);
    const zoneId = await createZone(otherZoneOwner.tenantId, otherZoneOwner.branchId, 500, 0);

    const { tenantId: tenantId2, productId } = await setupTenant("delivery-zone-attack");
    const { client, tableSessionId } = await bootstrapDelivery(tenantId2);
    openedSessionIds.add(tableSessionId);

    const { error } = await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }],
      p_delivery_zone_id: zoneId,
      p_delivery_address: "Adres",
    });
    expect(error?.message).toContain("invalid delivery zone");
  });
});
