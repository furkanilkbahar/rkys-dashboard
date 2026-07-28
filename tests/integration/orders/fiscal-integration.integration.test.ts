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
  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, owner };
}

async function createPayment(tenantId: string, branchId: string) {
  const service = serviceRoleClient();
  const tableId = crypto.randomUUID();
  await service.from("tables").insert({ id: tableId, tenant_id: tenantId, branch_id: branchId, label: "x", qr_token_hash: crypto.randomUUID() });
  const { data: session } = await service
    .from("table_sessions")
    .insert({ tenant_id: tenantId, branch_id: branchId, table_id: tableId, status: "active" })
    .select("id")
    .single();
  const { data: payment } = await service
    .from("payments")
    .insert({ tenant_id: tenantId, branch_id: branchId, table_session_id: session!.id, method: "cash", amount_minor: 5000, status: "completed" })
    .select("id")
    .single();
  return payment!.id as string;
}

describe("fiscal_receipts RLS ve get_fiscal_daily_summary RPC (Faz 17 Adım 0, S67)", () => {
  it("staff kendi tenant'ının fişini görür, başka tenant'ınkini göremez", async () => {
    const { tenantId: tenantAId, branchId: branchAId, owner: ownerA } = await setupTenant("fiscal-isolation-a");
    const paymentId = await createPayment(tenantAId, branchAId);
    const service = serviceRoleClient();
    await service.from("fiscal_receipts").insert({ tenant_id: tenantAId, branch_id: branchAId, payment_id: paymentId, provider: "mock", provider_ref: "mock-test-1" });

    const { data: ownData } = await ownerA.from("fiscal_receipts").select("id").eq("payment_id", paymentId);
    expect(ownData).toHaveLength(1);

    const { owner: ownerB } = await setupTenant("fiscal-isolation-b");
    const { data: crossData, error } = await ownerB.from("fiscal_receipts").select("id").eq("payment_id", paymentId);
    expect(error).toBeNull();
    expect(crossData).toEqual([]);
  });

  it("get_fiscal_daily_summary bugünkü fiş sayısı ve toplamını doğru hesaplar", async () => {
    const { tenantId, branchId, owner } = await setupTenant("fiscal-summary");
    const paymentId1 = await createPayment(tenantId, branchId);
    const paymentId2 = await createPayment(tenantId, branchId);
    const service = serviceRoleClient();
    await service.from("fiscal_receipts").insert([
      { tenant_id: tenantId, branch_id: branchId, payment_id: paymentId1, provider: "mock", provider_ref: "mock-test-2" },
      { tenant_id: tenantId, branch_id: branchId, payment_id: paymentId2, provider: "mock", provider_ref: "mock-test-3" },
    ]);

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    const { data, error } = await owner.rpc("get_fiscal_daily_summary", { p_business_date: today });
    expect(error).toBeNull();
    expect(data![0]).toEqual({ receipt_count: 2, total_amount_minor: 10000 });
  });

  it("voided fiş günlük özete dahil edilmez", async () => {
    const { tenantId, branchId, owner } = await setupTenant("fiscal-voided");
    const paymentId = await createPayment(tenantId, branchId);
    const service = serviceRoleClient();
    await service
      .from("fiscal_receipts")
      .insert({ tenant_id: tenantId, branch_id: branchId, payment_id: paymentId, provider: "mock", provider_ref: "mock-test-4", status: "voided" });

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    const { data } = await owner.rpc("get_fiscal_daily_summary", { p_business_date: today });
    expect(data![0]).toEqual({ receipt_count: 0, total_amount_minor: 0 });
  });
});
