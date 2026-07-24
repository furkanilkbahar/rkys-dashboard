import { afterAll, describe, expect, it } from "vitest";

import { createThrowawayTenant, serviceRoleClient } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function setupTenant(prefix: string, marketplaceEnabled = true) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();
  await service.from("tenant_modules").insert({ tenant_id: tenant.tenantId, module_key: "marketplace", is_enabled: marketplaceEnabled });

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenant.tenantId, layout: "grid", display_order: 0 });
  await service
    .from("products")
    .insert({ id: productId, tenant_id: tenant.tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 1000, stock_quantity: 50, display_order: 0 });

  return { ...tenant, productId };
}

async function mapSku(tenantId: string, provider: string, externalSku: string, productId: string) {
  const service = serviceRoleClient();
  await service.from("product_external_mappings").insert({ tenant_id: tenantId, provider, external_sku: externalSku, product_id: productId });
}

describe("ingest_marketplace_order (Faz 10 Adım 2, S43)", () => {
  it("marketplace modülü kapalıyken reddedilir", async () => {
    const { tenantId, productId } = await setupTenant("mp-disabled", false);
    await mapSku(tenantId, "mock", "SKU-1", productId);
    const service = serviceRoleClient();

    const { error } = await service.rpc("ingest_marketplace_order", {
      p_tenant_id: tenantId,
      p_provider: "mock",
      p_external_order_id: "ext-1",
      p_items: [{ externalSku: "SKU-1", quantity: 1, unitPriceMinor: 1000, name: "Ürün" }],
    });
    expect(error?.message).toContain("marketplace module not enabled");
  });

  it("eşlenmemiş SKU reddedilir", async () => {
    const { tenantId } = await setupTenant("mp-unmapped");
    const service = serviceRoleClient();

    const { error } = await service.rpc("ingest_marketplace_order", {
      p_tenant_id: tenantId,
      p_provider: "mock",
      p_external_order_id: "ext-1",
      p_items: [{ externalSku: "UNKNOWN", quantity: 1, unitPriceMinor: 1000, name: "Ürün" }],
    });
    expect(error?.message).toContain("SKU_NOT_MAPPED");
  });

  it("geçerli sipariş kanalı='marketplace', durum='approved' olarak oluşturulur ve stok düşer", async () => {
    const { tenantId, branchId, productId } = await setupTenant("mp-success");
    await mapSku(tenantId, "mock", "SKU-1", productId);
    const service = serviceRoleClient();

    const { data, error } = await service.rpc("ingest_marketplace_order", {
      p_tenant_id: tenantId,
      p_provider: "mock",
      p_external_order_id: "ext-1",
      p_items: [{ externalSku: "SKU-1", quantity: 3, unitPriceMinor: 1200, name: "Ürün" }],
    });
    expect(error).toBeNull();
    expect(data![0].is_duplicate).toBe(false);

    const { data: order } = await service
      .from("orders")
      .select("id, channel, status, subtotal_minor, branch_id, table_sessions(channel, external_provider, external_order_id)")
      .eq("id", data![0].order_id)
      .single();
    expect(order?.channel).toBe("marketplace");
    expect(order?.status).toBe("approved");
    expect(order?.subtotal_minor).toBe(3600);
    expect(order?.branch_id).toBe(branchId);
    expect(order?.table_sessions?.channel).toBe("marketplace");
    expect(order?.table_sessions?.external_provider).toBe("mock");
    expect(order?.table_sessions?.external_order_id).toBe("ext-1");

    const { data: items } = await service.from("order_items").select("quantity, unit_price_minor, line_subtotal_minor").eq("order_id", data![0].order_id);
    expect(items).toEqual([{ quantity: 3, unit_price_minor: 1200, line_subtotal_minor: 3600 }]);

    const { data: product } = await service.from("products").select("stock_quantity").eq("id", productId).single();
    expect(product?.stock_quantity).toBe(47);
  });

  it("aynı external_order_id tekrar gönderilirse yeni sipariş açmaz, aynı order_id + is_duplicate=true döner", async () => {
    const { tenantId, productId } = await setupTenant("mp-idempotent");
    await mapSku(tenantId, "mock", "SKU-1", productId);
    const service = serviceRoleClient();

    const first = await service.rpc("ingest_marketplace_order", {
      p_tenant_id: tenantId,
      p_provider: "mock",
      p_external_order_id: "ext-dup",
      p_items: [{ externalSku: "SKU-1", quantity: 1, unitPriceMinor: 1000, name: "Ürün" }],
    });
    const second = await service.rpc("ingest_marketplace_order", {
      p_tenant_id: tenantId,
      p_provider: "mock",
      p_external_order_id: "ext-dup",
      p_items: [{ externalSku: "SKU-1", quantity: 1, unitPriceMinor: 1000, name: "Ürün" }],
    });

    expect(second.data![0].order_id).toBe(first.data![0].order_id);
    expect(second.data![0].is_duplicate).toBe(true);

    const { count } = await service.from("orders").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
    expect(count).toBe(1);
  });
});
