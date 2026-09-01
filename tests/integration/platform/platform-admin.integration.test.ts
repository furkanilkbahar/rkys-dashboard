import { afterAll, describe, expect, it } from "vitest";

import { SEED, anonClient, createPlatformAdmin, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const createdUserIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of createdUserIds) {
    await service.auth.admin.deleteUser(id);
  }
});

describe("custom_access_token_hook: platform_admin dalı (Adım 0)", () => {
  it("platform_admins'te aktif satırı olan kullanıcı is_platform_admin+user_role=platform_admin claim'i alır", async () => {
    const admin = await createPlatformAdmin("hook-active");
    createdUserIds.add(admin.userId);

    const { data } = await admin.client.auth.getClaims();
    const claims = data!.claims as Record<string, unknown>;
    expect(claims.is_platform_admin).toBe(true);
    expect(claims.user_role).toBe("platform_admin");
    expect(claims.tenant_id).toBeUndefined();
  });

  it("is_active=false olan platform admin claim almaz (fail-closed)", async () => {
    const service = serviceRoleClient();
    const { data: authUser } = await service.auth.admin.createUser({
      email: `platform-inactive-${crypto.randomUUID().slice(0, 8)}@test-throwaway.test`,
      password: SEED.password,
      email_confirm: true,
    });
    createdUserIds.add(authUser!.user!.id);
    await service.from("platform_admins").insert({ id: authUser!.user!.id, is_active: false });

    const client = anonClient();
    await client.auth.signInWithPassword({ email: authUser!.user!.email!, password: SEED.password });
    const { data } = await client.auth.getClaims();
    const claims = data!.claims as Record<string, unknown>;
    expect(claims.is_platform_admin).toBeUndefined();
  });

  it("normal personel (owner) claim'inde is_platform_admin hiçbir zaman basılmaz — karışma yok", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data } = await owner.auth.getClaims();
    const claims = data!.claims as Record<string, unknown>;
    expect(claims.is_platform_admin).toBeUndefined();
    expect(claims.user_role).toBe("owner");
    expect(claims.tenant_id).toBe(SEED.acme.tenantId);
  });

  it("platform admin tüm tenant'ları görür (tenants_platform_admin_all RLS, 0002), normal owner yalnızca kendisini görür", async () => {
    const admin = await createPlatformAdmin("rls");
    createdUserIds.add(admin.userId);

    const { data: allTenants, error } = await admin.client.from("tenants").select("id, slug");
    expect(error).toBeNull();
    expect(allTenants!.length).toBeGreaterThanOrEqual(3);
    expect(allTenants!.some((t) => t.slug === "acme")).toBe(true);
    expect(allTenants!.some((t) => t.slug === "beta")).toBe(true);

    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: ownTenants } = await owner.from("tenants").select("id, slug");
    expect(ownTenants).toHaveLength(1);
    expect(ownTenants![0].slug).toBe("acme");
  });

  // Bu garanti 0098'e kadar hiçbir yerde YAZILI DEĞİLDİ: `public` şemasının
  // varsayılan yetkilerinde authenticated'e SELECT verilmemesine güveniliyordu.
  // CI'nın postgres imajı 17.6.1.147 → 17.6.1.165 değişince varsayılan da
  // değişti ve garanti sessizce kayboldu (test 2026-09-01'de CI'da düştü,
  // lokalde geçmeye devam etti). 0098 revoke'u açıkça yazıyor; test de artık
  // aynı deseni paylaşan ÜÇ politikasız RLS tablosunun hepsini kapsıyor.
  it.each(["platform_admins", "otp_codes", "staff_pin_secrets"] as const)(
    "politikasız RLS tablosu %s authenticated tarafından doğrudan okunamaz — yalnızca service_role",
    async (table) => {
      const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
      const { error } = await owner.from(table).select("*");
      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
    },
  );
});
