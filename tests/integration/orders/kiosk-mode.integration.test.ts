import { afterAll, describe, expect, it } from "vitest";

import { createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function setupTenant(prefix: string, kioskEnabled = true) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();
  await service.from("tenant_modules").insert({ tenant_id: tenant.tenantId, module_key: "kiosk", is_enabled: kioskEnabled });
  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, owner };
}

async function registerDevice(tenantId: string, branchId: string, pairingCode: string, isActive = true) {
  const service = serviceRoleClient();
  await service.from("kiosk_devices").insert({ tenant_id: tenantId, branch_id: branchId, device_name: "Test Tablet", pairing_code: pairingCode, is_active: isActive });
}

describe("open_kiosk_session (Faz 11 Adım 1, S46)", () => {
  it("geçerli pairing code ile channel='pickup' oturum açar, kiosk_device_id set edilir", async () => {
    const { tenantId, branchId } = await setupTenant("kiosk-success");
    await registerDevice(tenantId, branchId, "CODE01");
    const service = serviceRoleClient();

    const { data, error } = await service.rpc("open_kiosk_session", { p_tenant_id: tenantId, p_pairing_code: "CODE01" });
    expect(error).toBeNull();
    expect(data![0].pickup_code).toMatch(/^[A-Z0-9]{6}$/);

    const { data: session } = await service
      .from("table_sessions")
      .select("channel, kiosk_device_id")
      .eq("id", data![0].table_session_id)
      .single();
    expect(session?.channel).toBe("pickup");
    expect(session?.kiosk_device_id).not.toBeNull();
  });

  it("kiosk modülü kapalıyken reddedilir", async () => {
    const { tenantId, branchId } = await setupTenant("kiosk-disabled", false);
    await registerDevice(tenantId, branchId, "CODE02");
    const service = serviceRoleClient();

    const { error } = await service.rpc("open_kiosk_session", { p_tenant_id: tenantId, p_pairing_code: "CODE02" });
    expect(error?.message).toContain("kiosk module not enabled");
  });

  it("geçersiz pairing code reddedilir", async () => {
    const { tenantId } = await setupTenant("kiosk-invalid-code");
    const service = serviceRoleClient();

    const { error } = await service.rpc("open_kiosk_session", { p_tenant_id: tenantId, p_pairing_code: "WRONG1" });
    expect(error?.message).toContain("invalid kiosk device");
  });

  it("pasif (is_active=false) cihazın pairing code'u reddedilir", async () => {
    const { tenantId, branchId } = await setupTenant("kiosk-inactive-device");
    await registerDevice(tenantId, branchId, "CODE03", false);
    const service = serviceRoleClient();

    const { error } = await service.rpc("open_kiosk_session", { p_tenant_id: tenantId, p_pairing_code: "CODE03" });
    expect(error?.message).toContain("invalid kiosk device");
  });

  it("başka tenant'ın pairing code'u kabul edilmez", async () => {
    const { tenantId: tenantAId, branchId: branchAId } = await setupTenant("kiosk-cross-tenant-a");
    const { tenantId: tenantBId } = await setupTenant("kiosk-cross-tenant-b");
    await registerDevice(tenantAId, branchAId, "SHARED1");
    const service = serviceRoleClient();

    const { error } = await service.rpc("open_kiosk_session", { p_tenant_id: tenantBId, p_pairing_code: "SHARED1" });
    expect(error?.message).toContain("invalid kiosk device");
  });
});

describe("kiosk_devices RLS izolasyonu (Faz 11 Adım 1, S46)", () => {
  it("personel kendi tenant'ının kiosk cihazını ekleyebilir ve görebilir", async () => {
    const { tenantId, branchId, owner } = await setupTenant("kiosk-rls-own");
    const { error: insertError } = await owner
      .from("kiosk_devices")
      .insert({ tenant_id: tenantId, branch_id: branchId, device_name: "Girişteki Tablet", pairing_code: "OWNCODE" });
    expect(insertError).toBeNull();

    const { data } = await owner.from("kiosk_devices").select("id").eq("tenant_id", tenantId);
    expect(data).toHaveLength(1);
  });

  it("A tenant'ının personeli B tenant'ının kiosk cihazını göremez", async () => {
    const { tenantId: tenantAId, branchId: branchAId } = await setupTenant("kiosk-rls-a");
    const { owner: ownerB } = await setupTenant("kiosk-rls-b");
    await registerDevice(tenantAId, branchAId, "AONLYCODE");

    const { data } = await ownerB.from("kiosk_devices").select("id").eq("tenant_id", tenantAId);
    expect(data).toHaveLength(0);
  });
});
