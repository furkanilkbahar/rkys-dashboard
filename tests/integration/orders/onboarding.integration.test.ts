import { afterAll, describe, expect, it } from "vitest";

import {
  SEED,
  bootstrapGuestForTable,
  createThrowawayTenant,
  serviceRoleClient,
  signInAsSeededOwner,
} from "../../helpers/testClients";

const openedSessionIds = new Set<string>();
let throwawayTenantIdToDelete: string | null = null;

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of openedSessionIds) {
    await service.from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id);
  }
  // Sonraki testleri etkilememek için gamma'yı yeniden onboarding-öncesi duruma al.
  await service.from("tenants").update({ onboarding_completed_at: null }).eq("id", SEED.gamma.tenantId);
  // tenants → * cascade (0002+) tek kullanımlık tenant'ı sipariş/oturum
  // geçmişiyle birlikte tamamen kaldırır — schema-and-seed.integration.test.ts'in
  // "3 tenant" sayımını etkilemesin diye şart.
  if (throwawayTenantIdToDelete) {
    await service.from("tenants").delete().eq("id", throwawayTenantIdToDelete);
  }
});

describe("RPC: onboarding", () => {
  it("clear_demo_data: sipariş yoksa demo katalog/masa/dil verisini temizler", async () => {
    const owner = await signInAsSeededOwner(SEED.gamma.ownerEmail);
    const { error } = await owner.rpc("clear_demo_data");
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: categories } = await service.from("menu_categories").select("id").eq("tenant_id", SEED.gamma.tenantId);
    const { data: tables } = await service.from("tables").select("id").eq("tenant_id", SEED.gamma.tenantId);
    const { data: locales } = await service.from("tenant_locales").select("locale").eq("tenant_id", SEED.gamma.tenantId);
    expect(categories).toHaveLength(0);
    expect(tables).toHaveLength(0);
    expect(locales).toHaveLength(0);
  });

  it("clear_demo_data: gerçek sipariş varsa tables/products silinemediği için tüm işlem geri alınır (RULES #18)", async () => {
    const service = serviceRoleClient();

    // table_sessions/orders satırları asla silinmez (RULES #18) — bu testin
    // oluşturacağı sipariş geçmişi kalıcı olarak temizlenemez kalacağı için
    // paylaşılan gamma fixture'ı yerine tek kullanımlık, atılabilir bir
    // tenant kurulur (diğer testleri/koşumları kirletmez).
    const throwaway = await createThrowawayTenant("order-block");
    throwawayTenantIdToDelete = throwaway.tenantId;

    const { data: category } = await service
      .from("menu_categories")
      .insert({ tenant_id: throwaway.tenantId, layout: "grid" })
      .select("id")
      .single();
    const { data: product } = await service
      .from("products")
      .insert({ tenant_id: throwaway.tenantId, category_id: category!.id, track_mode: "simple", base_price_minor: 5000 })
      .select("id")
      .single();
    const { data: table } = await service
      .from("tables")
      .insert({
        tenant_id: throwaway.tenantId,
        branch_id: throwaway.branchId,
        label: "Test Masa",
        qr_token_hash: crypto.randomUUID(),
      })
      .select("id")
      .single();

    const { client, tableSessionId } = await bootstrapGuestForTable(table!.id);
    openedSessionIds.add(tableSessionId);

    const { data: orderData, error: orderError } = await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId: product!.id, variantId: null, quantity: 1, extraIds: [] }],
    });
    expect(orderError).toBeNull();
    const orderId = orderData?.[0]?.order_id;
    expect(orderId).toBeTruthy();

    const owner = await signInAsSeededOwner(throwaway.email);
    const { error: clearError } = await owner.rpc("clear_demo_data");
    expect(clearError).not.toBeNull();

    const { data: survivingOrder } = await service.from("orders").select("id").eq("id", orderId!).maybeSingle();
    expect(survivingOrder?.id).toBe(orderId);

    const { data: survivingTable } = await service.from("tables").select("id").eq("id", table!.id).maybeSingle();
    expect(survivingTable?.id).toBe(table!.id);
  });

  it("complete_onboarding: onboarding_completed_at set edilir, sonrasında clear_demo_data reddedilir", async () => {
    const owner = await signInAsSeededOwner(SEED.gamma.ownerEmail);
    const { error } = await owner.rpc("complete_onboarding");
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: tenant } = await service
      .from("tenants")
      .select("onboarding_completed_at")
      .eq("id", SEED.gamma.tenantId)
      .single();
    expect(tenant?.onboarding_completed_at).not.toBeNull();

    const { error: clearError } = await owner.rpc("clear_demo_data");
    expect(clearError).not.toBeNull();
  });

  it("update_tenant_logo: yalnızca owner logo değiştirebilir", async () => {
    const owner = await signInAsSeededOwner(SEED.gamma.ownerEmail);
    const { error } = await owner.rpc("update_tenant_logo", { p_logo_url: "https://example.com/logo.png" });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data } = await service.from("tenants").select("logo_url").eq("id", SEED.gamma.tenantId).single();
    expect(data?.logo_url).toBe("https://example.com/logo.png");
  });
});
