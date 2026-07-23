import { afterAll, describe, expect, it } from "vitest";

import { SEED, createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

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

async function setupTenant(prefix: string) {
  const tenant = await createThrowawayTenant(prefix);
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

  const compReasonId = crypto.randomUUID();
  const refundReasonId = crypto.randomUUID();
  const cancelReasonId = crypto.randomUUID();
  await service.from("reason_codes").insert([
    { id: compReasonId, tenant_id: tenant.tenantId, category: "comp", key: "test_comp", display_order: 0 },
    { id: refundReasonId, tenant_id: tenant.tenantId, category: "refund", key: "test_refund", display_order: 0 },
    { id: cancelReasonId, tenant_id: tenant.tenantId, category: "cancel", key: "test_cancel", display_order: 0 },
  ]);
  await service.from("content_translations").insert({
    tenant_id: tenant.tenantId,
    entity_type: "reason_code",
    entity_id: compReasonId,
    locale: "tr",
    field: "name",
    value: "Test İkramı",
  });

  const owner = await signInAsSeededOwner(tenant.email);
  return {
    ...tenant,
    productId,
    counterTableId: counterTable!.id as string,
    owner,
    compReasonId,
    refundReasonId,
    cancelReasonId,
  };
}

async function submitAndPay(owner: Awaited<ReturnType<typeof signInAsSeededOwner>>, counterTableId: string, productId: string) {
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
  return { orderId: orderRow.order_id as string, subtotalMinor: orderRow.subtotal_minor as number, tableSessionId: session!.id as string };
}

describe("get_period_revenue_report / get_branch_comparison (Faz 5 Adım 1, S21)", () => {
  it("reports.revenue izni olmayan personel dönem raporunu okuyamaz", async () => {
    const waiter = await signInAsSeededOwner(SEED.acme.waiterEmail);
    const { error } = await waiter.rpc("get_period_revenue_report", {
      p_branch_id: SEED.acme.branchId,
      p_start_date: "2020-01-01",
      p_end_date: "2020-01-31",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("forbidden");
  });

  it("dönem toplamı, aralıktaki günlerin toplamına eşittir; aralık dışı günler dahil edilmez", async () => {
    const { tenantId, branchId, owner } = await setupTenant("period-total");
    const service = serviceRoleClient();

    await service.from("daily_sales_summary").insert([
      { tenant_id: tenantId, branch_id: branchId, business_date: "2025-06-01", revenue_minor: 10000, cash_minor: 10000, card_manual_minor: 0, online_minor: 0, tips_minor: 0, comps_minor: 0, refunds_minor: 0, order_count: 2 },
      { tenant_id: tenantId, branch_id: branchId, business_date: "2025-06-02", revenue_minor: 20000, cash_minor: 20000, card_manual_minor: 0, online_minor: 0, tips_minor: 0, comps_minor: 0, refunds_minor: 0, order_count: 3 },
      { tenant_id: tenantId, branch_id: branchId, business_date: "2025-07-01", revenue_minor: 99999, cash_minor: 99999, card_manual_minor: 0, online_minor: 0, tips_minor: 0, comps_minor: 0, refunds_minor: 0, order_count: 1 },
    ]);

    const { data, error } = await owner.rpc("get_period_revenue_report", {
      p_branch_id: branchId,
      p_start_date: "2025-06-01",
      p_end_date: "2025-06-30",
    });
    expect(error).toBeNull();
    expect(data![0].revenue_minor).toBe(30000);
    expect(data![0].order_count).toBe(5);
  });

  it("geçen yıl kıyası: aynı RPC'ye bir önceki yılın aralığı verilince yalnızca o yılın verisi döner", async () => {
    const { tenantId, branchId, owner } = await setupTenant("period-yoy");
    const service = serviceRoleClient();

    await service.from("daily_sales_summary").insert([
      { tenant_id: tenantId, branch_id: branchId, business_date: "2024-06-15", revenue_minor: 5000, cash_minor: 5000, card_manual_minor: 0, online_minor: 0, tips_minor: 0, comps_minor: 0, refunds_minor: 0, order_count: 1 },
      { tenant_id: tenantId, branch_id: branchId, business_date: "2025-06-15", revenue_minor: 15000, cash_minor: 15000, card_manual_minor: 0, online_minor: 0, tips_minor: 0, comps_minor: 0, refunds_minor: 0, order_count: 4 },
    ]);

    const { data: currentYear } = await owner.rpc("get_period_revenue_report", {
      p_branch_id: branchId,
      p_start_date: "2025-06-01",
      p_end_date: "2025-06-30",
    });
    const { data: previousYear } = await owner.rpc("get_period_revenue_report", {
      p_branch_id: branchId,
      p_start_date: "2024-06-01",
      p_end_date: "2024-06-30",
    });
    expect(currentYear![0].revenue_minor).toBe(15000);
    expect(previousYear![0].revenue_minor).toBe(5000);
  });

  it("şube kıyası: her şube kendi daily_sales_summary toplamıyla döner, izin gerekir", async () => {
    const { tenantId, branchId, owner } = await setupTenant("branch-cmp");
    const service = serviceRoleClient();
    await service.from("daily_sales_summary").insert({
      tenant_id: tenantId, branch_id: branchId, business_date: "2025-06-01",
      revenue_minor: 7000, cash_minor: 7000, card_manual_minor: 0, online_minor: 0, tips_minor: 0, comps_minor: 0, refunds_minor: 0, order_count: 2,
    });

    const { data, error } = await owner.rpc("get_branch_comparison", { p_start_date: "2025-06-01", p_end_date: "2025-06-30" });
    expect(error).toBeNull();
    const row = data!.find((r) => r.branch_id === branchId);
    expect(row?.revenue_minor).toBe(7000);
    expect(row?.order_count).toBe(2);

    const waiter = await signInAsSeededOwner(SEED.acme.waiterEmail);
    const { error: forbiddenError } = await waiter.rpc("get_branch_comparison", { p_start_date: "2025-06-01", p_end_date: "2025-06-30" });
    expect(forbiddenError).not.toBeNull();
    expect(forbiddenError?.message).toContain("forbidden");
  });
});

describe("get_loss_report (Faz 5 Adım 1, S21)", () => {
  it("reports.loss izni olmayan personel kayıp-kaçak raporunu göremez", async () => {
    const waiter = await signInAsSeededOwner(SEED.acme.waiterEmail);
    const { error } = await waiter.rpc("get_loss_report", {
      p_branch_id: SEED.acme.branchId,
      p_start_date: "2020-01-01",
      p_end_date: "2020-01-31",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("forbidden");
  });

  it("comp/refund/iptal sebep koduna göre doğru gruplanır; sebepsiz iptal ayrı satırda görünür", async () => {
    const { branchId, productId, counterTableId, owner, compReasonId, refundReasonId, cancelReasonId } = await setupTenant("loss-report");
    const today = todayInTenantTimezone();
    const service = serviceRoleClient();

    const { orderId: compOrderId } = await submitAndPay(owner, counterTableId, productId);
    const { data: compId } = await owner.rpc("record_comp", { p_order_id: compOrderId, p_amount_minor: 1500, p_reason_code_id: compReasonId });
    expect(compId).toBeTruthy();

    const { tableSessionId: refundSessionId } = await submitAndPay(owner, counterTableId, productId);
    const { data: payment } = await service
      .from("payments")
      .select("id, amount_minor, tip_amount_minor")
      .eq("table_session_id", refundSessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const { data: refundId } = await owner.rpc("record_refund", {
      p_payment_id: payment!.id,
      p_amount_minor: payment!.amount_minor + payment!.tip_amount_minor,
      p_reason_code_id: refundReasonId,
    });
    expect(refundId).toBeTruthy();

    // İptal (sebep kodlu): preparing aşamasına ilerletilir, misafir istek simülasyonu
    // service role ile doğrudan yapılır (guest RPC akışını tekrar kurmadan), sonra
    // approve_cancellation_request personel onayı + sebep kodunu uygular.
    const { data: cancelWithReasonOrder } = await owner.rpc("submit_staff_order", {
      p_table_id: counterTableId,
      p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }],
    });
    const cancelWithReasonOrderId = cancelWithReasonOrder![0].order_id as string;
    const cancelWithReasonSubtotal = cancelWithReasonOrder![0].subtotal_minor as number;
    await owner.rpc("advance_order_status", { p_order_id: cancelWithReasonOrderId, p_to_status: "preparing" });
    await service.from("orders").update({ cancel_requested_at: new Date().toISOString(), cancel_requested_reason: "test" }).eq("id", cancelWithReasonOrderId);
    const { error: approveError } = await owner.rpc("approve_cancellation_request", {
      p_order_id: cancelWithReasonOrderId,
      p_reason_code_id: cancelReasonId,
    });
    expect(approveError).toBeNull();

    // İptal (sebepsiz): reason_code_id verilmeden onaylanır.
    const { data: cancelNoReasonOrder } = await owner.rpc("submit_staff_order", {
      p_table_id: counterTableId,
      p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }],
    });
    const cancelNoReasonOrderId = cancelNoReasonOrder![0].order_id as string;
    const cancelNoReasonSubtotal = cancelNoReasonOrder![0].subtotal_minor as number;
    await owner.rpc("advance_order_status", { p_order_id: cancelNoReasonOrderId, p_to_status: "preparing" });
    await service.from("orders").update({ cancel_requested_at: new Date().toISOString(), cancel_requested_reason: "test" }).eq("id", cancelNoReasonOrderId);
    const { error: approveNoReasonError } = await owner.rpc("approve_cancellation_request", { p_order_id: cancelNoReasonOrderId });
    expect(approveNoReasonError).toBeNull();

    const { data: rows, error } = await owner.rpc("get_loss_report", { p_branch_id: branchId, p_start_date: today, p_end_date: today });
    expect(error).toBeNull();

    const compRow = rows!.find((r) => r.source === "comp");
    expect(compRow?.reason_key).toBe("test_comp");
    expect(compRow?.amount_minor).toBe(1500);
    expect(compRow?.item_count).toBe(1);

    const refundRow = rows!.find((r) => r.source === "refund");
    expect(refundRow?.reason_key).toBe("test_refund");
    expect(refundRow?.amount_minor).toBe(5000); // ürünün base_price_minor'ı, tam iade
    expect(refundRow?.item_count).toBe(1);

    const cancelWithReasonRow = rows!.find((r) => r.source === "cancel" && r.reason_code_id === cancelReasonId);
    expect(cancelWithReasonRow?.reason_key).toBe("test_cancel");
    expect(cancelWithReasonRow?.amount_minor).toBe(cancelWithReasonSubtotal);
    expect(cancelWithReasonRow?.item_count).toBe(1);

    const cancelNoReasonRow = rows!.find((r) => r.source === "cancel" && r.reason_code_id === null);
    expect(cancelNoReasonRow?.amount_minor).toBe(cancelNoReasonSubtotal);
    expect(cancelNoReasonRow?.item_count).toBe(1);
  });

  it("tarih aralığı dışındaki kayıtlar rapora dahil edilmez", async () => {
    const { tenantId, branchId, productId, counterTableId, owner, compReasonId } = await setupTenant("loss-out-of-range");
    const service = serviceRoleClient();

    const { orderId } = await submitAndPay(owner, counterTableId, productId);
    await service.from("comps").insert({
      tenant_id: tenantId,
      branch_id: branchId,
      order_id: orderId,
      amount_minor: 500,
      reason_code_id: compReasonId,
      created_at: "2020-01-01T00:00:00Z",
    });

    const today = todayInTenantTimezone();
    const { data: rows } = await owner.rpc("get_loss_report", { p_branch_id: branchId, p_start_date: today, p_end_date: today });
    expect(rows).toHaveLength(0);
  });
});
