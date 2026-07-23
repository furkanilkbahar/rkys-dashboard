import { afterAll, describe, expect, it } from "vitest";

import type { Json } from "@/lib/supabase/types";

import { createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function setupTenant(prefix: string, mode: "stamp" | "points" | null, config: Record<string, unknown> = {}) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();

  await service.from("tenant_modules").insert([
    { tenant_id: tenant.tenantId, module_key: "pos_cash", is_enabled: true },
    { tenant_id: tenant.tenantId, module_key: "crm_loyalty", is_enabled: true },
  ]);
  if (mode) {
    await service.from("loyalty_programs").insert({ tenant_id: tenant.tenantId, mode, config: config as Json, is_active: true });
  }

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenant.tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenant.tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 5000, display_order: 0 });

  const { data: counterTable } = await service
    .from("tables")
    .select("id")
    .eq("tenant_id", tenant.tenantId)
    .eq("branch_id", tenant.branchId)
    .eq("is_counter", true)
    .single();

  const { data: customer } = await service
    .from("customers")
    .insert({ tenant_id: tenant.tenantId, phone: "+905550000000", kvkk_consented_at: new Date().toISOString() })
    .select("id")
    .single();

  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, productId, counterTableId: counterTable!.id as string, customerId: customer!.id as string, owner };
}

async function openOrderedSession(
  owner: Awaited<ReturnType<typeof signInAsSeededOwner>>,
  counterTableId: string,
  productId: string,
  quantity: number,
  customerId?: string,
) {
  const { data } = await owner.rpc("submit_staff_order", {
    p_table_id: counterTableId,
    p_items: [{ productId, variantId: null, quantity, extraIds: [] }],
  });
  const service = serviceRoleClient();
  const { data: session } = await service.from("table_sessions").select("id").eq("table_id", counterTableId).eq("status", "active").single();
  if (customerId) {
    await service.from("table_sessions").update({ customer_id: customerId }).eq("id", session!.id);
  }
  return {
    tableSessionId: session!.id as string,
    orderId: data![0].order_id as string,
    subtotalMinor: data![0].subtotal_minor as number,
  };
}

describe("Sadakat motoru: kazanım (Faz 7 Adım 1, S31)", () => {
  it("stamp modunda oturum tam ödenince 1 damga kazanılır", async () => {
    const { counterTableId, productId, customerId, owner } = await setupTenant("loyalty-earn-stamp", "stamp", { threshold: 5, rewardValueMinor: 5000 });
    const { tableSessionId, subtotalMinor } = await openOrderedSession(owner, counterTableId, productId, 1, customerId);

    const { error } = await owner.rpc("record_payment", { p_table_session_id: tableSessionId, p_method: "cash", p_amount_minor: subtotalMinor });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: balance } = await service.from("loyalty_balances").select("balance").eq("customer_id", customerId).single();
    expect(balance?.balance).toBe(1);

    const { data: txns } = await service.from("loyalty_transactions").select("delta, type").eq("customer_id", customerId);
    expect(txns).toHaveLength(1);
    expect(txns![0]).toEqual({ delta: 1, type: "earn" });
  });

  it("points modunda oturum tam ödenince earnRatePer100Minor'a göre puan kazanılır", async () => {
    const { counterTableId, productId, customerId, owner } = await setupTenant("loyalty-earn-points", "points", {
      earnRatePer100Minor: 2,
      redeemRateMinorPerPoint: 50,
    });
    const { tableSessionId, subtotalMinor } = await openOrderedSession(owner, counterTableId, productId, 1, customerId);

    await owner.rpc("record_payment", { p_table_session_id: tableSessionId, p_method: "cash", p_amount_minor: subtotalMinor });

    // subtotal 5000 kuruş, rate 2/100 → 100 puan.
    const service = serviceRoleClient();
    const { data: balance } = await service.from("loyalty_balances").select("balance").eq("customer_id", customerId).single();
    expect(balance?.balance).toBe(100);
  });

  it("oturum bir müşteriye bağlı değilse hiçbir şey kazanılmaz", async () => {
    const { counterTableId, productId, customerId, owner } = await setupTenant("loyalty-no-customer", "stamp", { threshold: 5, rewardValueMinor: 5000 });
    const { tableSessionId, subtotalMinor } = await openOrderedSession(owner, counterTableId, productId, 1);

    await owner.rpc("record_payment", { p_table_session_id: tableSessionId, p_method: "cash", p_amount_minor: subtotalMinor });

    const service = serviceRoleClient();
    const { data: balance } = await service.from("loyalty_balances").select("balance").eq("customer_id", customerId).maybeSingle();
    expect(balance).toBeNull();
  });
});

describe("Sadakat motoru: harcama (Faz 7 Adım 1, S31)", () => {
  it("stamp modunda eşik altında bakiye redeem'i reddedilir", async () => {
    const { counterTableId, productId, customerId, owner } = await setupTenant("loyalty-redeem-stamp-insufficient", "stamp", {
      threshold: 5,
      rewardValueMinor: 5000,
    });
    const { orderId } = await openOrderedSession(owner, counterTableId, productId, 1, customerId);

    const { error } = await owner.rpc("redeem_loyalty_to_order", { p_order_id: orderId });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("insufficient loyalty balance");
  });

  it("stamp modunda eşiğe ulaşan bakiye sabit ödül tutarı kadar comp yazar ve eşik kadar düşer", async () => {
    const { tenantId, counterTableId, productId, customerId, owner } = await setupTenant("loyalty-redeem-stamp-ok", "stamp", {
      threshold: 2,
      rewardValueMinor: 3000,
    });
    const { orderId } = await openOrderedSession(owner, counterTableId, productId, 1, customerId);

    const service = serviceRoleClient();
    await service.from("loyalty_balances").insert({ customer_id: customerId, tenant_id: tenantId, balance: 2 });

    const { data: discount, error } = await owner.rpc("redeem_loyalty_to_order", { p_order_id: orderId });
    expect(error).toBeNull();
    expect(discount).toBe(3000);

    const { data: balance } = await service.from("loyalty_balances").select("balance").eq("customer_id", customerId).single();
    expect(balance?.balance).toBe(0);

    const { data: comps } = await service.from("comps").select("amount_minor").eq("order_id", orderId);
    expect(comps).toHaveLength(1);
    expect(comps![0].amount_minor).toBe(3000);
  });

  it("points modunda tüm bakiye kullanılır, sipariş tutarını aşarsa kısmen tüketilir", async () => {
    const { tenantId, counterTableId, productId, customerId, owner } = await setupTenant("loyalty-redeem-points-cap", "points", {
      earnRatePer100Minor: 1,
      redeemRateMinorPerPoint: 100,
    });
    // subtotal 5000 kuruş → 200 puan bakiye ile tam tutarı aşan bir talep simüle edilir.
    const { orderId } = await openOrderedSession(owner, counterTableId, productId, 1, customerId);

    const service = serviceRoleClient();
    await service.from("loyalty_balances").insert({ customer_id: customerId, tenant_id: tenantId, balance: 200 });

    const { data: discount, error } = await owner.rpc("redeem_loyalty_to_order", { p_order_id: orderId });
    expect(error).toBeNull();
    // 200 puan * 100 = 20000, sipariş 5000 → 5000'de kapanır, 50 puan tüketilir.
    expect(discount).toBe(5000);

    const { data: balance } = await service.from("loyalty_balances").select("balance").eq("customer_id", customerId).single();
    expect(balance?.balance).toBe(150);
  });

  it("crm_loyalty modülü kapalıysa redeem reddeder", async () => {
    const { counterTableId, productId, customerId, tenantId, owner } = await setupTenant("loyalty-redeem-disabled", "stamp", {
      threshold: 1,
      rewardValueMinor: 5000,
    });
    await serviceRoleClient().from("tenant_modules").update({ is_enabled: false }).eq("tenant_id", tenantId).eq("module_key", "crm_loyalty");
    const { orderId } = await openOrderedSession(owner, counterTableId, productId, 1, customerId);

    const { error } = await owner.rpc("redeem_loyalty_to_order", { p_order_id: orderId });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("crm_loyalty module not enabled");
  });
});
