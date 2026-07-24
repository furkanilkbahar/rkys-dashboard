import { createHash } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function setupTenant(prefix: string, apiEnabled = true) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();
  await service.from("tenant_modules").insert({ tenant_id: tenant.tenantId, module_key: "api_access", is_enabled: apiEnabled });
  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, owner };
}

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

async function createApiKey(tenantId: string, rawKey: string) {
  const service = serviceRoleClient();
  await service.from("api_keys").insert({ tenant_id: tenantId, name: "test key", key_hash: sha256(rawKey), key_prefix: rawKey.slice(-4) });
}

describe("Tenant API — API key kimlik doğrulama (Faz 10 Adım 0, S41)", () => {
  it("geçerli anahtar doğru tenant_id'ye çözülür, last_used_at güncellenir", async () => {
    const { tenantId } = await setupTenant("apikey-auth");
    const rawKey = "rkys_live_testkey1";
    await createApiKey(tenantId, rawKey);

    const service = serviceRoleClient();
    const { data: resolvedTenantId, error } = await service.rpc("authenticate_api_key", { p_key_hash: sha256(rawKey) });
    expect(error).toBeNull();
    expect(resolvedTenantId).toBe(tenantId);

    const { data: key } = await service.from("api_keys").select("last_used_at").eq("tenant_id", tenantId).single();
    expect(key?.last_used_at).not.toBeNull();
  });

  it("geçersiz anahtar null döner", async () => {
    const service = serviceRoleClient();
    const { data, error } = await service.rpc("authenticate_api_key", { p_key_hash: sha256("does-not-exist") });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("api_access modülü kapalıyken geçerli bir anahtar bile reddedilir", async () => {
    const { tenantId } = await setupTenant("apikey-disabled", false);
    const rawKey = "rkys_live_testkey2";
    await createApiKey(tenantId, rawKey);

    const service = serviceRoleClient();
    const { data } = await service.rpc("authenticate_api_key", { p_key_hash: sha256(rawKey) });
    expect(data).toBeNull();
  });

  it("iptal edilmiş (is_active=false) anahtar reddedilir", async () => {
    const { tenantId } = await setupTenant("apikey-revoked");
    const rawKey = "rkys_live_testkey3";
    await createApiKey(tenantId, rawKey);
    const service = serviceRoleClient();
    await service.from("api_keys").update({ is_active: false }).eq("tenant_id", tenantId);

    const { data } = await service.rpc("authenticate_api_key", { p_key_hash: sha256(rawKey) });
    expect(data).toBeNull();
  });
});

describe("getApiOrders veri katmanı (Faz 10 Adım 0, S41)", () => {
  it("yalnızca kendi tenant'ının siparişlerini, en yeniden eskiye döner", async () => {
    const { tenantId, branchId, owner } = await setupTenant("apikey-orders-query");
    const service = serviceRoleClient();
    const categoryId = crypto.randomUUID();
    const productId = crypto.randomUUID();
    await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
    await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 2500, display_order: 0 });
    await service.from("tenant_modules").insert({ tenant_id: tenantId, module_key: "pos_cash", is_enabled: true });
    const { data: counterTable } = await service.from("tables").select("id").eq("tenant_id", tenantId).eq("branch_id", branchId).eq("is_counter", true).single();
    const { error: orderError } = await owner.rpc("submit_staff_order", { p_table_id: counterTable!.id, p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }] });
    expect(orderError).toBeNull();

    const { getApiOrders } = await import("@/lib/api/queries");
    const orders = await getApiOrders(tenantId);
    expect(orders).toHaveLength(1);
    expect(orders[0].channel).toBe("dine_in");
    expect(orders[0].items).toEqual([{ productName: "", variantName: null, quantity: 1, unitPriceMinor: 2500 }]);
  });
});
