import { describe, expect, it } from "vitest";

import { SEED, anonClient, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

/**
 * D102: staff_pin_secrets ham PIN'in ŞİFRELİ kopyasını tutar. Diğer tenant
 * tablolarından farklı olarak burada "kendi tenant'ını görür" kuralı YOK —
 * tabloyu hiçbir authenticated rol (owner dahil) okuyamaz. Ciphertext yalnız
 * sunucudaki service-role yolundan çıkar; anahtar bir gün sızsa bile
 * personelin toplayabildiği bir ciphertext birikimi olmasın diye.
 */
describe("RLS: staff_pin_secrets", () => {
  it("owner bile bu tabloyu okuyamaz (policy yok + grant yok)", async () => {
    const service = serviceRoleClient();
    const { data: profile } = await service
      .from("profiles")
      .select("id")
      .eq("tenant_id", SEED.acme.tenantId)
      .eq("role", "waiter")
      .single();
    await service.from("staff_pin_secrets").upsert({
      profile_id: profile!.id,
      tenant_id: SEED.acme.tenantId,
      pin_encrypted: "test-ciphertext",
    });

    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await owner.from("staff_pin_secrets").select("pin_encrypted");

    // PostgREST yetkisiz okumada hata döndürür; hata dönmese bile satır
    // gelmemeli — iki koşuldan biri bile sağlanmazsa ciphertext sızıyor.
    expect(error !== null || (data ?? []).length === 0).toBe(true);

    // D93: paket seed tenant'ına yazdığını toplar — sahte ciphertext kalırsa
    // "PIN Göster" seed garsonunda çözülemeyen bir kayda denk gelir.
    await service.from("staff_pin_secrets").delete().eq("profile_id", profile!.id);
  });

  it("anon okuyamaz", async () => {
    const { data, error } = await anonClient().from("staff_pin_secrets").select("pin_encrypted");

    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("owner yazamaz — kayıt yalnız sunucu tarafından (service-role) yazılır", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner.from("staff_pin_secrets").insert({
      profile_id: SEED.acme.tenantId,
      tenant_id: SEED.acme.tenantId,
      pin_encrypted: "sızdırma-denemesi",
    });

    expect(error).not.toBeNull();
  });

  it("personel silinince şifreli kopyası da gider (cascade)", async () => {
    const service = serviceRoleClient();
    const { data: authUser } = await service.auth.admin.createUser({
      email: `staff-${crypto.randomUUID()}@internal.rkys.local`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    await service.from("profiles").insert({
      id: authUser!.user!.id,
      tenant_id: SEED.acme.tenantId,
      role: "kitchen",
      full_name: "Cascade Testi",
      is_active: true,
    });
    await service.from("staff_pin_secrets").insert({
      profile_id: authUser!.user!.id,
      tenant_id: SEED.acme.tenantId,
      pin_encrypted: "cascade-ciphertext",
    });

    await service.auth.admin.deleteUser(authUser!.user!.id);

    const { data } = await service
      .from("staff_pin_secrets")
      .select("profile_id")
      .eq("profile_id", authUser!.user!.id);
    expect(data ?? []).toHaveLength(0);
  });
});
