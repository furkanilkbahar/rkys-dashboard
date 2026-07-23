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

async function setupTenant(prefix: string) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, owner };
}

const TODAY = new Date().toISOString().slice(0, 10);

describe("get_loyalty_performance_report (Faz 7 Adım 3, S33)", () => {
  it("dönem içindeki kazanım/harcama toplamlarını ve aktif müşteri sayısını doğru hesaplar", async () => {
    const { tenantId, owner } = await setupTenant("loyalty-report");
    const service = serviceRoleClient();

    const { data: customerA } = await service.from("customers").insert({ tenant_id: tenantId, phone: "+905551110001", kvkk_consented_at: new Date().toISOString() }).select("id").single();
    const { data: customerB } = await service.from("customers").insert({ tenant_id: tenantId, phone: "+905551110002", kvkk_consented_at: new Date().toISOString() }).select("id").single();

    await service.from("loyalty_transactions").insert([
      { tenant_id: tenantId, customer_id: customerA!.id, delta: 10, type: "earn" },
      { tenant_id: tenantId, customer_id: customerA!.id, delta: -4, type: "redeem" },
      { tenant_id: tenantId, customer_id: customerB!.id, delta: 20, type: "earn" },
    ]);

    const { data, error } = await owner.rpc("get_loyalty_performance_report", { p_start_date: TODAY, p_end_date: TODAY });
    expect(error).toBeNull();
    expect(data![0]).toEqual({
      points_earned: 30,
      points_redeemed: 4,
      active_customers: 2,
      redemption_count: 1,
    });
  });

  it("tarih aralığı dışındaki işlemler sayılmaz", async () => {
    const { tenantId, owner } = await setupTenant("loyalty-report-out-of-range");
    const service = serviceRoleClient();
    const { data: customer } = await service.from("customers").insert({ tenant_id: tenantId, phone: "+905551110003", kvkk_consented_at: new Date().toISOString() }).select("id").single();

    await service.from("loyalty_transactions").insert({
      tenant_id: tenantId,
      customer_id: customer!.id,
      delta: 50,
      type: "earn",
      created_at: "2020-01-01T00:00:00Z",
    });

    const { data } = await owner.rpc("get_loyalty_performance_report", { p_start_date: TODAY, p_end_date: TODAY });
    expect(data![0]).toEqual({ points_earned: 0, points_redeemed: 0, active_customers: 0, redemption_count: 0 });
  });
});

describe("get_campaign_performance_report (Faz 7 Adım 3, S33)", () => {
  it("kampanya başına kullanım sayısını ve toplam indirimi doğru hesaplar", async () => {
    const { tenantId, owner } = await setupTenant("campaign-report");
    const service = serviceRoleClient();

    const categoryId = crypto.randomUUID();
    const productId = crypto.randomUUID();
    await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
    await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 5000, display_order: 0 });

    const campaignId = crypto.randomUUID();
    await service.from("campaigns").insert({
      id: campaignId, tenant_id: tenantId, name: "Rapor Kampanyası", rule_type: "percentage_off",
      rule_config: { percentage: 10 } as Json, is_active: true,
    });
    const couponId = crypto.randomUUID();
    await service.from("coupons").insert({ id: couponId, tenant_id: tenantId, campaign_id: campaignId, code: "REPORT10", is_active: true });

    const { data: reasonCode } = await service.from("reason_codes").select("id").eq("tenant_id", tenantId).eq("category", "campaign").single();

    // İki farklı sipariş için iki ayrı redemption + comp — orders tablosuna
    // FK zorunlu olduğu için gerçek order satırları kullanılır.
    for (const amount of [500, 300]) {
      const tableSessionId = crypto.randomUUID();
      const orderId = crypto.randomUUID();
      const { data: branch } = await service.from("branches").select("id").eq("tenant_id", tenantId).single();
      const tableId = crypto.randomUUID();
      await service.from("tables").insert({ id: tableId, tenant_id: tenantId, branch_id: branch!.id, label: `Masa ${orderId.slice(0, 4)}`, qr_token_hash: crypto.randomUUID() });
      await service.from("table_sessions").insert({ id: tableSessionId, tenant_id: tenantId, branch_id: branch!.id, table_id: tableId, status: "active" });
      await service.from("orders").insert({
        id: orderId, tenant_id: tenantId, branch_id: branch!.id, table_session_id: tableSessionId,
        status: "approved", subtotal_minor: amount * 10, channel: "dine_in", idempotency_key: crypto.randomUUID(),
      });
      const { data: comp } = await service
        .from("comps")
        .insert({ tenant_id: tenantId, branch_id: branch!.id, order_id: orderId, amount_minor: amount, reason_code_id: reasonCode!.id })
        .select("id")
        .single();
      await service.from("coupon_redemptions").insert({ tenant_id: tenantId, coupon_id: couponId, order_id: orderId, comp_id: comp!.id });
    }

    const { data, error } = await owner.rpc("get_campaign_performance_report", { p_start_date: TODAY, p_end_date: TODAY });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]).toEqual({
      campaign_id: campaignId,
      campaign_name: "Rapor Kampanyası",
      redemption_count: 2,
      total_discount_minor: 800,
    });
  });

  it("kullanım yoksa boş liste döner", async () => {
    const { owner } = await setupTenant("campaign-report-empty");
    const { data, error } = await owner.rpc("get_campaign_performance_report", { p_start_date: TODAY, p_end_date: TODAY });
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});

describe("Rapor RPC'leri: yetki (Faz 7 Adım 3, S33)", () => {
  it("reports.revenue izni olmayan personel her iki raporu da okuyamaz", async () => {
    const { tenantId } = await createThrowawayTenant("report-perm");
    cleanupTenantIds.add(tenantId);
    const service = serviceRoleClient();
    const waiterEmail = `waiter-${crypto.randomUUID().slice(0, 8)}@test-throwaway.test`;
    const { data: authUser } = await service.auth.admin.createUser({ email: waiterEmail, password: "password123", email_confirm: true });
    await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "waiter", is_active: true });
    const waiter = await signInAsSeededOwner(waiterEmail);

    const { error: loyaltyError } = await waiter.rpc("get_loyalty_performance_report", { p_start_date: TODAY, p_end_date: TODAY });
    expect(loyaltyError).not.toBeNull();

    const { error: campaignError } = await waiter.rpc("get_campaign_performance_report", { p_start_date: TODAY, p_end_date: TODAY });
    expect(campaignError).not.toBeNull();
  });
});
