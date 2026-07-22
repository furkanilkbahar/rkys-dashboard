import { afterAll, describe, expect, it } from "vitest";

import { SEED, createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

// close_business_day/get_revenue_report "business_date"i tenant saat
// diliminde (Europe/Istanbul, tüm test tenant'larının varsayılanı) hesaplar
// (0035, is_business_date_closed). UTC gün sınırının Istanbul'dan ~3 saat
// geride olduğu pencerede (21:00-24:00 UTC) new Date().toISOString()'in
// verdiği UTC tarih farklı bir güne düşebilir — bu yüzden "bugün" burada da
// aynı saat dilimiyle hesaplanır.
function todayInTenantTimezone(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function setupClosableTenant() {
  const tenant = await createThrowawayTenant("day-closure");
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();

  await service.from("tenant_modules").insert({ tenant_id: tenant.tenantId, module_key: "pos_cash", is_enabled: true });

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenant.tenantId, layout: "grid", display_order: 0 });
  await service
    .from("products")
    .insert({ id: productId, tenant_id: tenant.tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 5000, display_order: 0 });

  const { data: counterTable } = await service
    .from("tables")
    .select("id")
    .eq("tenant_id", tenant.tenantId)
    .eq("branch_id", tenant.branchId)
    .eq("is_counter", true)
    .single();

  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, productId, counterTableId: counterTable!.id as string, owner };
}

async function orderAndPay(owner: Awaited<ReturnType<typeof signInAsSeededOwner>>, counterTableId: string, productId: string) {
  const { data } = await owner.rpc("submit_staff_order", {
    p_table_id: counterTableId,
    p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }],
  });
  const orderRow = data![0];
  const service = serviceRoleClient();
  const { data: session } = await service
    .from("table_sessions")
    .select("id")
    .eq("table_id", counterTableId)
    .eq("status", "active")
    .single();

  await owner.rpc("record_payment", {
    p_table_session_id: session!.id,
    p_method: "cash",
    p_amount_minor: orderRow.subtotal_minor,
    p_tip_amount_minor: 0,
  });
  return { subtotalMinor: orderRow.subtotal_minor as number };
}

describe("RPC: close_business_day + rapor seti (S9)", () => {
  it("cash.open_close izni olmayan personel günü kapatamaz", async () => {
    const waiter = await signInAsSeededOwner(SEED.acme.waiterEmail);
    const { error } = await waiter.rpc("close_business_day", { p_branch_id: SEED.acme.branchId });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("forbidden");
  });

  it("reports.revenue izni olmayan personel rapor okuyamaz", async () => {
    const waiter = await signInAsSeededOwner(SEED.acme.waiterEmail);
    const { error } = await waiter.rpc("get_revenue_report", {
      p_branch_id: SEED.acme.branchId,
      p_business_date: todayInTenantTimezone(),
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("forbidden");
  });

  it("günü kapatır: doğru snapshot oluşur, ikinci kez kapatılamaz, o güne yeni ödeme/kasa hareketi reddedilir", async () => {
    const { branchId, productId, counterTableId, owner } = await setupClosableTenant();
    const { subtotalMinor } = await orderAndPay(owner, counterTableId, productId);

    const today = todayInTenantTimezone();
    const { data: revenue } = await owner.rpc("get_revenue_report", { p_branch_id: branchId, p_business_date: today });
    expect(revenue![0].revenue_minor).toBe(subtotalMinor);
    expect(revenue![0].cash_minor).toBe(subtotalMinor);

    const { data: topProducts } = await owner.rpc("get_top_products", { p_branch_id: branchId, p_business_date: today });
    expect(topProducts).toHaveLength(1);
    expect(topProducts![0].quantity).toBe(1);

    const { data: closureId, error: closeError } = await owner.rpc("close_business_day", { p_branch_id: branchId });
    expect(closeError).toBeNull();
    expect(closureId).toBeTruthy();

    const service = serviceRoleClient();
    const { data: closure } = await service.from("day_closures").select("business_date, revenue_minor, cash_minor").eq("id", closureId!).single();
    expect(closure?.business_date).toBe(today);
    expect(closure?.revenue_minor).toBe(subtotalMinor);
    expect(closure?.cash_minor).toBe(subtotalMinor);

    const { error: secondCloseError } = await owner.rpc("close_business_day", { p_branch_id: branchId });
    expect(secondCloseError).not.toBeNull();
    expect(secondCloseError?.message).toContain("already closed");

    // Kapanmış güne yeni ödeme reddedilir (RULES #36 — düzeltme = yeni gün, mevcut kayıt değişmez).
    const { data: newOrderData } = await owner.rpc("submit_staff_order", {
      p_table_id: counterTableId,
      p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }],
    });
    const { data: newSession } = await service.from("table_sessions").select("id").eq("table_id", counterTableId).eq("status", "active").single();
    const { error: blockedPaymentError } = await owner.rpc("record_payment", {
      p_table_session_id: newSession!.id,
      p_method: "cash",
      p_amount_minor: newOrderData![0].subtotal_minor,
      p_tip_amount_minor: 0,
    });
    expect(blockedPaymentError).not.toBeNull();
    expect(blockedPaymentError?.message).toContain("business day closed");

    // Kapanmış güne yeni kasa hareketi de reddedilir.
    const { data: shiftId } = await owner.rpc("open_shift", { p_branch_id: branchId, p_opening_balance_minor: 0 });
    const { error: blockedMovementError } = await owner.rpc("record_cash_movement", {
      p_shift_id: shiftId!,
      p_movement_type: "cash_in",
      p_amount_minor: 100,
    });
    expect(blockedMovementError).not.toBeNull();
    expect(blockedMovementError?.message).toContain("business day closed");
  });
});

describe("product_costs (Adım 6 — manuel maliyet/marj)", () => {
  it("personel kendi tenant'ının ürün maliyetini kaydedebilir; RLS diğer tenant'a kapalı", async () => {
    const { tenantId, productId, owner } = await setupClosableTenant();

    const { error } = await owner.from("product_costs").upsert({ product_id: productId, tenant_id: tenantId, cost_minor: 2000 });
    expect(error).toBeNull();

    const { data: ownRead } = await owner.from("product_costs").select("cost_minor").eq("product_id", productId).single();
    expect(ownRead?.cost_minor).toBe(2000);

    const acmeOwner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: crossTenantRead } = await acmeOwner.from("product_costs").select("product_id").eq("product_id", productId);
    expect(crossTenantRead).toHaveLength(0);
  });
});
