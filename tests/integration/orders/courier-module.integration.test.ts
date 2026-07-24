import { afterAll, describe, expect, it } from "vitest";

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
  const service = serviceRoleClient();
  await service.from("tenant_modules").insert([
    { tenant_id: tenant.tenantId, module_key: "delivery", is_enabled: true },
    { tenant_id: tenant.tenantId, module_key: "courier", is_enabled: true },
  ]);
  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, owner };
}

async function createCourier(tenantId: string) {
  const service = serviceRoleClient();
  const email = `courier-${crypto.randomUUID().slice(0, 8)}@test-throwaway.test`;
  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "courier", is_active: true });
  return authUser!.user!.id as string;
}

async function createDeliveryOrder(tenantId: string, branchId: string, subtotalMinor = 5000) {
  const service = serviceRoleClient();
  const tableId = crypto.randomUUID();
  await service.from("tables").insert({ id: tableId, tenant_id: tenantId, branch_id: branchId, label: "x", qr_token_hash: crypto.randomUUID() });
  const { data: session } = await service
    .from("table_sessions")
    .insert({ tenant_id: tenantId, branch_id: branchId, table_id: null, channel: "delivery", status: "active" })
    .select("id")
    .single();
  const orderId = crypto.randomUUID();
  await service.from("orders").insert({
    id: orderId, tenant_id: tenantId, branch_id: branchId, table_session_id: session!.id,
    status: "approved", subtotal_minor: subtotalMinor, channel: "delivery", idempotency_key: crypto.randomUUID(),
    delivery_address_snapshot: "Test Adres",
  });
  return orderId;
}

describe("Kurye modülü (Faz 9 Adım 2, S40)", () => {
  it("assign_courier delivery siparişine role='courier' bir profil atar", async () => {
    const { tenantId, branchId, owner } = await setupTenant("courier-assign");
    const courierId = await createCourier(tenantId);
    const orderId = await createDeliveryOrder(tenantId, branchId);

    const { data: assignmentId, error } = await owner.rpc("assign_courier", { p_order_id: orderId, p_courier_id: courierId });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: assignment } = await service.from("courier_assignments").select("courier_id, status, order_id").eq("id", assignmentId!).single();
    expect(assignment).toEqual({ courier_id: courierId, status: "assigned", order_id: orderId });
  });

  it("courier rolünde olmayan bir profile atama yapılamaz", async () => {
    const { tenantId, branchId, owner } = await setupTenant("courier-invalid-role");
    const orderId = await createDeliveryOrder(tenantId, branchId);
    const service = serviceRoleClient();
    const { data: ownerProfile } = await service.from("profiles").select("id").eq("tenant_id", tenantId).eq("role", "owner").single();

    const { error } = await owner.rpc("assign_courier", { p_order_id: orderId, p_courier_id: ownerProfile!.id });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("invalid courier");
  });

  it("dine_in siparişine kurye atanamaz", async () => {
    const { tenantId, branchId, owner } = await setupTenant("courier-dine-in");
    const courierId = await createCourier(tenantId);
    const service = serviceRoleClient();
    const tableId = crypto.randomUUID();
    await service.from("tables").insert({ id: tableId, tenant_id: tenantId, branch_id: branchId, label: "x", qr_token_hash: crypto.randomUUID() });
    const { data: session } = await service.from("table_sessions").insert({ tenant_id: tenantId, branch_id: branchId, table_id: tableId, status: "active" }).select("id").single();
    const orderId = crypto.randomUUID();
    await service.from("orders").insert({
      id: orderId, tenant_id: tenantId, branch_id: branchId, table_session_id: session!.id,
      status: "approved", subtotal_minor: 1000, channel: "dine_in", idempotency_key: crypto.randomUUID(),
    });

    const { error } = await owner.rpc("assign_courier", { p_order_id: orderId, p_courier_id: courierId });
    expect(error?.message).toContain("order is not a delivery order");
  });

  it("advance_courier_assignment sıralı geçişleri kabul eder, atlamayı reddeder", async () => {
    const { tenantId, branchId, owner } = await setupTenant("courier-advance");
    const courierId = await createCourier(tenantId);
    const orderId = await createDeliveryOrder(tenantId, branchId);
    const { data: assignmentId } = await owner.rpc("assign_courier", { p_order_id: orderId, p_courier_id: courierId });

    const skipAttempt = await owner.rpc("advance_courier_assignment", { p_assignment_id: assignmentId!, p_to_status: "delivered" });
    expect(skipAttempt.error?.message).toContain("ILLEGAL_TRANSITION");

    const { error: firstError } = await owner.rpc("advance_courier_assignment", { p_assignment_id: assignmentId!, p_to_status: "en_route" });
    expect(firstError).toBeNull();

    const { error: secondError } = await owner.rpc("advance_courier_assignment", { p_assignment_id: assignmentId!, p_to_status: "delivered" });
    expect(secondError).toBeNull();

    const service = serviceRoleClient();
    const { data: assignment } = await service.from("courier_assignments").select("status, en_route_at, delivered_at").eq("id", assignmentId!).single();
    expect(assignment?.status).toBe("delivered");
    expect(assignment?.en_route_at).not.toBeNull();
    expect(assignment?.delivered_at).not.toBeNull();
  });

  it("get_courier_daily_summary teslim edilen sipariş sayısı+tutarını doğru hesaplar", async () => {
    const { tenantId, branchId, owner } = await setupTenant("courier-summary");
    const courierId = await createCourier(tenantId);
    const orderId = await createDeliveryOrder(tenantId, branchId, 7500);
    const { data: assignmentId } = await owner.rpc("assign_courier", { p_order_id: orderId, p_courier_id: courierId });
    await owner.rpc("advance_courier_assignment", { p_assignment_id: assignmentId!, p_to_status: "en_route" });
    await owner.rpc("advance_courier_assignment", { p_assignment_id: assignmentId!, p_to_status: "delivered" });

    // Tenant saat dilimi Europe/Istanbul — "bugün" UTC'den değil, o saat
    // diliminden hesaplanır (bkz. TESTING.md §7'deki UTC/tenant-saat-dilimi
    // açığı; burada aynı hatayı tekrarlamamak için doğrudan Istanbul'un
    // takvim gününü kullanıyoruz).
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    const { data, error } = await owner.rpc("get_courier_daily_summary", { p_courier_id: courierId, p_business_date: today });
    expect(error).toBeNull();
    expect(data![0]).toEqual({ delivered_count: 1, total_amount_minor: 7500 });
  });
});
