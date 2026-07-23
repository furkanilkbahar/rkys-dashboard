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

async function setupClosableTenant() {
  const tenant = await createThrowawayTenant("daily-summary");
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

describe("daily_sales_summary (Faz 5 Adım 0)", () => {
  it("gün kapatılınca doğru değerlerle bir satır oluşur; ikinci (reddedilen) kapatma denemesi tekrar satır yazmaz", async () => {
    const { tenantId, branchId, productId, counterTableId, owner } = await setupClosableTenant();
    const { subtotalMinor } = await orderAndPay(owner, counterTableId, productId);
    const today = todayInTenantTimezone();

    const { error: closeError } = await owner.rpc("close_business_day", { p_branch_id: branchId });
    expect(closeError).toBeNull();

    const service = serviceRoleClient();
    const { data: rows } = await service
      .from("daily_sales_summary")
      .select("business_date, revenue_minor, cash_minor, order_count")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId);
    expect(rows).toHaveLength(1);
    expect(rows![0].business_date).toBe(today);
    expect(rows![0].revenue_minor).toBe(subtotalMinor);
    expect(rows![0].cash_minor).toBe(subtotalMinor);
    expect(rows![0].order_count).toBe(1);

    const { error: secondCloseError } = await owner.rpc("close_business_day", { p_branch_id: branchId });
    expect(secondCloseError).not.toBeNull();
    expect(secondCloseError?.message).toContain("already closed");

    const { data: rowsAfterSecondAttempt } = await service
      .from("daily_sales_summary")
      .select("business_date")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId);
    expect(rowsAfterSecondAttempt).toHaveLength(1);
  });

  it("RLS: yalnızca kendi tenant'ının personeli daily_sales_summary'yi okuyabilir", async () => {
    const { tenantId, branchId, productId, counterTableId, owner } = await setupClosableTenant();
    await orderAndPay(owner, counterTableId, productId);
    await owner.rpc("close_business_day", { p_branch_id: branchId });

    const acmeOwner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: crossTenantRead } = await acmeOwner.from("daily_sales_summary").select("business_date").eq("tenant_id", tenantId);
    expect(crossTenantRead).toHaveLength(0);

    const { data: ownRead } = await owner.from("daily_sales_summary").select("business_date").eq("tenant_id", tenantId);
    expect(ownRead).toHaveLength(1);
  });
});
