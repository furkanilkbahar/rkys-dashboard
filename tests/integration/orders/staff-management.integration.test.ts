import { describe, expect, it } from "vitest";

import { SEED, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

describe("RPC: personel yönetimi", () => {
  it("owner bir garsonun rolünü ve badge_no'sunu güncelleyebilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const service = serviceRoleClient();
    const { data: waiterProfile } = await service
      .from("profiles")
      .select("id")
      .eq("tenant_id", SEED.acme.tenantId)
      .eq("role", "waiter")
      .single();

    const { error } = await owner.rpc("update_staff_member", {
      p_profile_id: waiterProfile!.id,
      p_role: "waiter",
      p_badge_no: "W-42",
      p_is_active: true,
    });
    expect(error).toBeNull();

    const { data: updated } = await service.from("profiles").select("badge_no").eq("id", waiterProfile!.id).single();
    expect(updated?.badge_no).toBe("W-42");
  });

  it("staff.manage izni olmayan waiter personel güncelleyemez", async () => {
    const service = serviceRoleClient();
    const waiterClient = await signInAsSeededOwner(SEED.acme.waiterEmail);

    const { data: someProfile } = await service
      .from("profiles")
      .select("id")
      .eq("tenant_id", SEED.acme.tenantId)
      .eq("role", "waiter")
      .single();

    const { error } = await waiterClient.rpc("update_staff_member", {
      p_profile_id: someProfile!.id,
      p_role: "waiter",
      p_badge_no: "X",
      p_is_active: true,
    });
    expect(error).not.toBeNull();
  });

  it("son owner düşürülemez", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const service = serviceRoleClient();
    const { data: ownerProfile } = await service
      .from("profiles")
      .select("id")
      .eq("tenant_id", SEED.acme.tenantId)
      .eq("role", "owner")
      .single();

    const { error } = await owner.rpc("update_staff_member", {
      p_profile_id: ownerProfile!.id,
      p_role: "manager",
      p_badge_no: "",
      p_is_active: true,
    });
    expect(error).not.toBeNull();
  });

  it("owner olmayan biri owner rolü atayamaz", async () => {
    const service = serviceRoleClient();
    const managerClient = await signInAsSeededOwner(SEED.acme.managerEmail);
    const { data: waiterProfile } = await service
      .from("profiles")
      .select("id")
      .eq("tenant_id", SEED.acme.tenantId)
      .eq("role", "waiter")
      .single();

    const { error } = await managerClient.rpc("update_staff_member", {
      p_profile_id: waiterProfile!.id,
      p_role: "owner",
      p_badge_no: "",
      p_is_active: true,
    });
    expect(error).not.toBeNull();
  });

  it("reset_staff_pin PIN'i düz metin olarak saklamaz", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const service = serviceRoleClient();
    const { data: waiterProfile } = await service
      .from("profiles")
      .select("id")
      .eq("tenant_id", SEED.acme.tenantId)
      .eq("role", "waiter")
      .single();

    const { error } = await owner.rpc("reset_staff_pin", { p_profile_id: waiterProfile!.id, p_new_pin: "1234" });
    expect(error).toBeNull();

    const { data: updated } = await service.from("profiles").select("pin_hash").eq("id", waiterProfile!.id).single();
    expect(updated?.pin_hash).not.toBe("1234");
    expect(updated?.pin_hash).toBeTruthy();
  });

  // 0071: iki personelin aynı PIN'i taşıması clock_in_or_out'u yanlış
  // personele yazdırabiliyordu. Kural yalnızca RPC'de yaşıyor — testi de
  // burada: "Personel Ekle" akışının üçüncü adımı tam olarak bu çağrı.
  it("reset_staff_pin tenant içinde zaten kullanılan bir PIN'i ikinci personele vermez", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const service = serviceRoleClient();
    const { data: waiterProfile } = await service
      .from("profiles")
      .select("id")
      .eq("tenant_id", SEED.acme.tenantId)
      .eq("role", "waiter")
      .single();
    await owner.rpc("reset_staff_pin", { p_profile_id: waiterProfile!.id, p_new_pin: "1234" });

    const { data: authUser } = await service.auth.admin.createUser({
      email: `staff-${crypto.randomUUID()}@internal.rkys.local`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    await service.from("profiles").insert({
      id: authUser!.user!.id,
      tenant_id: SEED.acme.tenantId,
      role: "kitchen",
      full_name: "PIN Çakışma Testi",
      is_active: true,
    });

    const { error } = await owner.rpc("reset_staff_pin", { p_profile_id: authUser!.user!.id, p_new_pin: "1234" });
    expect(error?.message).toContain("PIN_ALREADY_IN_USE");

    // profiles satırı auth.users cascade'iyle gider — seed tenant'ında
    // artık kalıntı personel bırakmıyoruz.
    await service.auth.admin.deleteUser(authUser!.user!.id);
  });

  it("create_staff_device ham secret'ı yalnızca dönüş değerinde verir, hash'i saklar", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: rawSecret, error } = await owner.rpc("create_staff_device", {
      p_branch_id: SEED.acme.branchId,
      p_label: "Kasa Terminali",
    });
    expect(error).toBeNull();
    expect(rawSecret).toBeTruthy();

    const service = serviceRoleClient();
    const { data: device } = await service
      .from("staff_devices")
      .select("device_secret_hash")
      .eq("tenant_id", SEED.acme.tenantId)
      .eq("device_label", "Kasa Terminali")
      .single();
    expect(device?.device_secret_hash).not.toBe(rawSecret);

    await service.from("staff_devices").delete().eq("tenant_id", SEED.acme.tenantId).eq("device_label", "Kasa Terminali");
  });

  it("revoke_staff_device cihazı pasif yapar", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: rawSecret } = await owner.rpc("create_staff_device", {
      p_branch_id: SEED.acme.branchId,
      p_label: "Geçici Cihaz",
    });
    expect(rawSecret).toBeTruthy();

    const service = serviceRoleClient();
    const { data: device } = await service
      .from("staff_devices")
      .select("id")
      .eq("tenant_id", SEED.acme.tenantId)
      .eq("device_label", "Geçici Cihaz")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const { error } = await owner.rpc("revoke_staff_device", { p_device_id: device!.id });
    expect(error).toBeNull();

    const { data: updated } = await service.from("staff_devices").select("is_active").eq("id", device!.id).single();
    expect(updated?.is_active).toBe(false);

    await service.from("staff_devices").delete().eq("tenant_id", SEED.acme.tenantId).eq("device_label", "Geçici Cihaz");
  });

  it("bir personel REST üzerinden doğrudan kendi rolünü değiştiremez (self-escalation koruması)", async () => {
    const service = serviceRoleClient();
    const waiterAuth = await signInAsSeededOwner(SEED.acme.waiterEmail);
    const { data: waiterProfile } = await service
      .from("profiles")
      .select("id")
      .eq("tenant_id", SEED.acme.tenantId)
      .eq("role", "waiter")
      .single();

    const { error } = await waiterAuth.from("profiles").update({ role: "owner" }).eq("id", waiterProfile!.id);
    expect(error).not.toBeNull();
  });
});
