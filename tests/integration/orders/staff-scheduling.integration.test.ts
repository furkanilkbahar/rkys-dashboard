import { afterAll, describe, expect, it } from "vitest";

import { createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function setupTenant(prefix: string, schedulingEnabled = true) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();
  await service.from("tenant_modules").insert({ tenant_id: tenant.tenantId, module_key: "staff_scheduling", is_enabled: schedulingEnabled });
  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, owner };
}

// create_staff_device/reset_staff_pin (0026, önceki fazdan) gerçek hash
// üretimini yapan mevcut RPC'lerdir — testte ham secret/PIN'i taklit etmek
// yerine bunlar kullanılır (admin UI'ının kendisi de bunları çağırıyor).
async function registerDeviceAndPin(owner: Awaited<ReturnType<typeof signInAsSeededOwner>>, branchId: string, pin: string) {
  const { data: rawSecret } = await owner.rpc("create_staff_device", { p_branch_id: branchId, p_label: "Test Device" });
  const { data: profile } = await owner.from("profiles").select("id").eq("role", "owner").single();
  await owner.rpc("reset_staff_pin", { p_profile_id: profile!.id, p_new_pin: pin });
  return { rawSecret: rawSecret as string, profileId: profile!.id as string };
}

describe("verify_staff_device / clock_in_or_out (Faz 11 Adım 2, S47)", () => {
  it("geçerli secret ile device_id döner, yanlış secret null döner", async () => {
    const { tenantId, branchId, owner } = await setupTenant("timeclock-verify");
    const { rawSecret } = await registerDeviceAndPin(owner, branchId, "1234");
    const service = serviceRoleClient();

    const { data: deviceId } = await service.rpc("verify_staff_device", { p_tenant_id: tenantId, p_secret: rawSecret });
    expect(deviceId).not.toBeNull();

    const { data: wrongDeviceId } = await service.rpc("verify_staff_device", { p_tenant_id: tenantId, p_secret: "wrong-secret" });
    expect(wrongDeviceId).toBeNull();
  });

  it("ilk çağrı 'in', ikinci çağrı 'out' döner (giriş-çıkış geçişi)", async () => {
    const { tenantId, branchId, owner } = await setupTenant("timeclock-toggle");
    const { rawSecret } = await registerDeviceAndPin(owner, branchId, "4321");
    const service = serviceRoleClient();
    const { data: deviceId } = await service.rpc("verify_staff_device", { p_tenant_id: tenantId, p_secret: rawSecret });

    const first = await service.rpc("clock_in_or_out", { p_tenant_id: tenantId, p_device_id: deviceId!, p_device_secret: rawSecret, p_pin: "4321" });
    expect(first.error).toBeNull();
    expect(first.data![0].action).toBe("in");

    const second = await service.rpc("clock_in_or_out", { p_tenant_id: tenantId, p_device_id: deviceId!, p_device_secret: rawSecret, p_pin: "4321" });
    expect(second.data![0].action).toBe("out");

    const { data: entries } = await service.from("timeclock_entries").select("clock_in_at, clock_out_at").eq("tenant_id", tenantId);
    expect(entries).toHaveLength(1);
    expect(entries![0].clock_out_at).not.toBeNull();
  });

  it("yanlış PIN reddedilir", async () => {
    const { tenantId, branchId, owner } = await setupTenant("timeclock-wrong-pin");
    const { rawSecret } = await registerDeviceAndPin(owner, branchId, "1111");
    const service = serviceRoleClient();
    const { data: deviceId } = await service.rpc("verify_staff_device", { p_tenant_id: tenantId, p_secret: rawSecret });

    const { error } = await service.rpc("clock_in_or_out", { p_tenant_id: tenantId, p_device_id: deviceId!, p_device_secret: rawSecret, p_pin: "9999" });
    expect(error?.message).toContain("invalid pin");
  });

  it("geçersiz cihaz secret'ı reddedilir", async () => {
    const { tenantId, branchId, owner } = await setupTenant("timeclock-wrong-device");
    const { rawSecret } = await registerDeviceAndPin(owner, branchId, "2222");
    const service = serviceRoleClient();
    const { data: deviceId } = await service.rpc("verify_staff_device", { p_tenant_id: tenantId, p_secret: rawSecret });

    const { error } = await service.rpc("clock_in_or_out", { p_tenant_id: tenantId, p_device_id: deviceId!, p_device_secret: "wrong", p_pin: "2222" });
    expect(error?.message).toContain("invalid device");
  });

  it("revoke edilmiş (is_active=false) cihaz artık kabul edilmez", async () => {
    const { tenantId, branchId, owner } = await setupTenant("timeclock-revoked");
    const { rawSecret } = await registerDeviceAndPin(owner, branchId, "3333");
    const service = serviceRoleClient();
    const { data: deviceId } = await service.rpc("verify_staff_device", { p_tenant_id: tenantId, p_secret: rawSecret });
    await owner.rpc("revoke_staff_device", { p_device_id: deviceId! });

    const { error } = await service.rpc("clock_in_or_out", { p_tenant_id: tenantId, p_device_id: deviceId!, p_device_secret: rawSecret, p_pin: "3333" });
    expect(error?.message).toContain("invalid device");
  });

  it("staff_scheduling modülü kapalıyken reddedilir", async () => {
    const { tenantId, branchId, owner } = await setupTenant("timeclock-disabled", false);
    const { rawSecret } = await registerDeviceAndPin(owner, branchId, "5555");
    const service = serviceRoleClient();
    const { data: deviceId } = await service.rpc("verify_staff_device", { p_tenant_id: tenantId, p_secret: rawSecret });

    const { error } = await service.rpc("clock_in_or_out", { p_tenant_id: tenantId, p_device_id: deviceId!, p_device_secret: rawSecret, p_pin: "5555" });
    expect(error?.message).toContain("staff_scheduling module not enabled");
  });
});

describe("staff_shifts RLS izolasyonu (Faz 11 Adım 2, S47)", () => {
  it("A tenant'ının personeli B tenant'ının vardiya çizelgesini göremez", async () => {
    const { tenantId: tenantAId, branchId: branchAId, owner: ownerA } = await setupTenant("shifts-rls-a");
    const { owner: ownerB } = await setupTenant("shifts-rls-b");
    const { data: profileA } = await ownerA.from("profiles").select("id").eq("role", "owner").single();
    await ownerA.from("staff_shifts").insert({
      tenant_id: tenantAId,
      branch_id: branchAId,
      profile_id: profileA!.id,
      shift_date: "2027-01-15",
      start_time: "09:00",
      end_time: "17:00",
    });

    const { data } = await ownerB.from("staff_shifts").select("id").eq("tenant_id", tenantAId);
    expect(data).toHaveLength(0);
  });
});
