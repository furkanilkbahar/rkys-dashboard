import { createHash } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { bootstrapGuestForTable, createThrowawayTenant, serviceRoleClient } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

async function setupTenantWithTable(prefix: string, crmLoyaltyEnabled = true) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();

  await service.from("tenant_modules").insert({ tenant_id: tenant.tenantId, module_key: "crm_loyalty", is_enabled: crmLoyaltyEnabled });

  const tableId = crypto.randomUUID();
  await service.from("tables").insert({
    id: tableId,
    tenant_id: tenant.tenantId,
    branch_id: tenant.branchId,
    label: "Masa 1",
    qr_token_hash: `test-${crypto.randomUUID()}`,
  });

  return { ...tenant, tableId };
}

describe("Müşteri kimliği: telefon+OTP + KVKK (Faz 7 Adım 0, S30)", () => {
  it("doğru kod + KVKK onayıyla oturuma customer_id bağlanır", async () => {
    const { tableId } = await setupTenantWithTable("otp-happy");
    const { client, tableSessionId } = await bootstrapGuestForTable(tableId);

    const code = "123456";
    const { error: reqError } = await client.rpc("request_loyalty_otp", {
      p_table_session_id: tableSessionId,
      p_phone: "+905551234567",
      p_code_hash: hashCode(code),
    });
    expect(reqError).toBeNull();

    const { data: customerId, error: verifyError } = await client.rpc("verify_loyalty_otp", {
      p_table_session_id: tableSessionId,
      p_phone: "+905551234567",
      p_code_hash: hashCode(code),
      p_kvkk_consent: true,
    });
    expect(verifyError).toBeNull();
    expect(customerId).toBeTruthy();

    const service = serviceRoleClient();
    const { data: session } = await service.from("table_sessions").select("customer_id").eq("id", tableSessionId).single();
    expect(session?.customer_id).toBe(customerId);
  });

  it("yanlış kod reddedilir", async () => {
    const { tableId } = await setupTenantWithTable("otp-wrong-code");
    const { client, tableSessionId } = await bootstrapGuestForTable(tableId);

    await client.rpc("request_loyalty_otp", {
      p_table_session_id: tableSessionId,
      p_phone: "+905551234567",
      p_code_hash: hashCode("123456"),
    });

    const { error } = await client.rpc("verify_loyalty_otp", {
      p_table_session_id: tableSessionId,
      p_phone: "+905551234567",
      p_code_hash: hashCode("999999"),
      p_kvkk_consent: true,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("invalid or expired");
  });

  it("süresi geçmiş kod reddedilir", async () => {
    const { tenantId, tableId } = await setupTenantWithTable("otp-expired");
    const { client, tableSessionId } = await bootstrapGuestForTable(tableId);

    const service = serviceRoleClient();
    await service.from("otp_codes").insert({
      tenant_id: tenantId,
      phone: "+905551234567",
      code_hash: hashCode("123456"),
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });

    const { error } = await client.rpc("verify_loyalty_otp", {
      p_table_session_id: tableSessionId,
      p_phone: "+905551234567",
      p_code_hash: hashCode("123456"),
      p_kvkk_consent: true,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("invalid or expired");
  });

  it("KVKK onayı olmadan reddedilir", async () => {
    const { tableId } = await setupTenantWithTable("otp-no-kvkk");
    const { client, tableSessionId } = await bootstrapGuestForTable(tableId);

    await client.rpc("request_loyalty_otp", {
      p_table_session_id: tableSessionId,
      p_phone: "+905551234567",
      p_code_hash: hashCode("123456"),
    });

    const { error } = await client.rpc("verify_loyalty_otp", {
      p_table_session_id: tableSessionId,
      p_phone: "+905551234567",
      p_code_hash: hashCode("123456"),
      p_kvkk_consent: false,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("kvkk consent required");
  });

  it("5 dakikada 3'ten fazla kod isteği reddedilir (RATE_LIMITED)", async () => {
    const { tableId } = await setupTenantWithTable("otp-rate-limit");
    const { client, tableSessionId } = await bootstrapGuestForTable(tableId);

    for (let i = 0; i < 3; i++) {
      const { error } = await client.rpc("request_loyalty_otp", {
        p_table_session_id: tableSessionId,
        p_phone: "+905551234567",
        p_code_hash: hashCode(`12345${i}`),
      });
      expect(error).toBeNull();
    }

    const { error } = await client.rpc("request_loyalty_otp", {
      p_table_session_id: tableSessionId,
      p_phone: "+905551234567",
      p_code_hash: hashCode("999999"),
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("RATE_LIMITED");
  });

  it("crm_loyalty modülü kapalı tenant'ta RPC reddeder", async () => {
    const { tableId } = await setupTenantWithTable("otp-disabled", false);
    const { client, tableSessionId } = await bootstrapGuestForTable(tableId);

    const { error } = await client.rpc("request_loyalty_otp", {
      p_table_session_id: tableSessionId,
      p_phone: "+905551234567",
      p_code_hash: hashCode("123456"),
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("crm_loyalty module not enabled");
  });

  it("misafir başka bir oturumun table_session_id'sini hedefleyemez", async () => {
    const { tableId: tableIdA } = await setupTenantWithTable("otp-cross-a");
    const { tableId: tableIdB } = await setupTenantWithTable("otp-cross-b");
    const { client: clientA } = await bootstrapGuestForTable(tableIdA);
    const { tableSessionId: sessionIdB } = await bootstrapGuestForTable(tableIdB);

    const { error } = await clientA.rpc("request_loyalty_otp", {
      p_table_session_id: sessionIdB,
      p_phone: "+905551234567",
      p_code_hash: hashCode("123456"),
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("guest table session required");
  });

  it("aynı telefon iki farklı tenant'ta bağımsız customers satırı açar", async () => {
    const { tenantId: tenantA, tableId: tableIdA } = await setupTenantWithTable("otp-tenant-a");
    const { tenantId: tenantB, tableId: tableIdB } = await setupTenantWithTable("otp-tenant-b");
    const phone = "+905559876543";

    const { client: clientA, tableSessionId: sessionA } = await bootstrapGuestForTable(tableIdA);
    await clientA.rpc("request_loyalty_otp", { p_table_session_id: sessionA, p_phone: phone, p_code_hash: hashCode("111111") });
    const { data: customerIdA } = await clientA.rpc("verify_loyalty_otp", {
      p_table_session_id: sessionA,
      p_phone: phone,
      p_code_hash: hashCode("111111"),
      p_kvkk_consent: true,
    });

    const { client: clientB, tableSessionId: sessionB } = await bootstrapGuestForTable(tableIdB);
    await clientB.rpc("request_loyalty_otp", { p_table_session_id: sessionB, p_phone: phone, p_code_hash: hashCode("222222") });
    const { data: customerIdB } = await clientB.rpc("verify_loyalty_otp", {
      p_table_session_id: sessionB,
      p_phone: phone,
      p_code_hash: hashCode("222222"),
      p_kvkk_consent: true,
    });

    expect(customerIdA).not.toBe(customerIdB);

    const service = serviceRoleClient();
    const { data: customers } = await service.from("customers").select("tenant_id, phone").in("tenant_id", [tenantA, tenantB]);
    expect(customers).toHaveLength(2);
  });
});
