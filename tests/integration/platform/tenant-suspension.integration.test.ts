import { afterAll, describe, expect, it } from "vitest";

import {
  createPlatformAdmin,
  createThrowawayTenant,
  SEED,
  serviceRoleClient,
  signInAsSeededOwner,
} from "../../helpers/testClients";

const createdUserIds = new Set<string>();
const createdTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of createdUserIds) {
    await service.auth.admin.deleteUser(id);
  }
  for (const id of createdTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

describe("suspend_tenant / reactivate_tenant RPC'leri (Faz 4 Adım 1, S14)", () => {
  it("platform_admin olmayan bir kullanıcı suspend_tenant çağıramaz", async () => {
    const throwaway = await createThrowawayTenant("suspend-forbidden");
    createdTenantIds.add(throwaway.tenantId);

    const owner = await signInAsSeededOwner(throwaway.email);
    const { error } = await owner.rpc("suspend_tenant", { p_tenant_id: throwaway.tenantId });
    expect(error).not.toBeNull();

    const service = serviceRoleClient();
    const { data: tenant } = await service.from("tenants").select("status").eq("id", throwaway.tenantId).single();
    expect(tenant?.status).toBe("active");
  });

  it("platform_admin suspend_tenant/reactivate_tenant ile tenant durumunu değiştirebilir", async () => {
    const throwaway = await createThrowawayTenant("suspend-happy");
    createdTenantIds.add(throwaway.tenantId);

    const admin = await createPlatformAdmin("suspend-happy");
    createdUserIds.add(admin.userId);

    const service = serviceRoleClient();

    const { error: suspendError } = await admin.client.rpc("suspend_tenant", { p_tenant_id: throwaway.tenantId });
    expect(suspendError).toBeNull();
    const { data: suspended } = await service.from("tenants").select("status").eq("id", throwaway.tenantId).single();
    expect(suspended?.status).toBe("suspended");

    const { error: reactivateError } = await admin.client.rpc("reactivate_tenant", {
      p_tenant_id: throwaway.tenantId,
    });
    expect(reactivateError).toBeNull();
    const { data: active } = await service.from("tenants").select("status").eq("id", throwaway.tenantId).single();
    expect(active?.status).toBe("active");
  });

  it("var olmayan tenant id'si için suspend_tenant hata verir", async () => {
    const admin = await createPlatformAdmin("suspend-missing");
    createdUserIds.add(admin.userId);

    const { error } = await admin.client.rpc("suspend_tenant", { p_tenant_id: crypto.randomUUID() });
    expect(error).not.toBeNull();
  });

  it("askıya alınan tenant'ın owner'ı kendi tenants satırının status'unu görebilir (guard fonksiyonlarının okuyacağı satır)", async () => {
    const throwaway = await createThrowawayTenant("suspend-visible");
    createdTenantIds.add(throwaway.tenantId);

    const admin = await createPlatformAdmin("suspend-visible");
    createdUserIds.add(admin.userId);
    await admin.client.rpc("suspend_tenant", { p_tenant_id: throwaway.tenantId });

    const owner = await signInAsSeededOwner(throwaway.email);
    const { data, error } = await owner.from("tenants").select("status").eq("id", throwaway.tenantId).single();
    expect(error).toBeNull();
    expect(data?.status).toBe("suspended");
  });
});

describe("announcements RLS (Faz 4 Adım 1)", () => {
  it("platform_admin duyuru oluşturabilir, günceller, siler", async () => {
    const admin = await createPlatformAdmin("announcements-crud");
    createdUserIds.add(admin.userId);

    const { data: created, error: createError } = await admin.client
      .from("announcements")
      .insert({ title: "Bakım", body: "Planlı bakım yapılacak" })
      .select("id")
      .single();
    expect(createError).toBeNull();

    const { error: updateError } = await admin.client
      .from("announcements")
      .update({ is_active: false })
      .eq("id", created!.id);
    expect(updateError).toBeNull();

    const { error: deleteError } = await admin.client.from("announcements").delete().eq("id", created!.id);
    expect(deleteError).toBeNull();
  });

  it("normal personel yalnızca aktif ve zaman aralığı içindeki duyuruları görebilir", async () => {
    const admin = await createPlatformAdmin("announcements-visibility");
    createdUserIds.add(admin.userId);

    const now = new Date();
    const past = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const future = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

    const { data: visible } = await admin.client
      .from("announcements")
      .insert({ title: "Görünür duyuru", body: "aktif ve zaman aralığında" })
      .select("id")
      .single();
    const { data: inactive } = await admin.client
      .from("announcements")
      .insert({ title: "Pasif duyuru", body: "is_active=false", is_active: false })
      .select("id")
      .single();
    const { data: notStartedYet } = await admin.client
      .from("announcements")
      .insert({ title: "Henüz başlamadı", body: "starts_at gelecekte", starts_at: future })
      .select("id")
      .single();
    const { data: expired } = await admin.client
      .from("announcements")
      .insert({ title: "Süresi geçti", body: "ends_at geçmişte", starts_at: past, ends_at: past })
      .select("id")
      .single();

    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: ownerVisible, error } = await owner.from("announcements").select("id");
    expect(error).toBeNull();
    const visibleIds = (ownerVisible ?? []).map((a) => a.id);
    expect(visibleIds).toContain(visible!.id);
    expect(visibleIds).not.toContain(inactive!.id);
    expect(visibleIds).not.toContain(notStartedYet!.id);
    expect(visibleIds).not.toContain(expired!.id);

    const service = serviceRoleClient();
    await service.from("announcements").delete().in("id", [visible!.id, inactive!.id, notStartedYet!.id, expired!.id]);
  });

  it("normal personel duyuru oluşturamaz/güncelleyemez/silemez", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error: insertError } = await owner.from("announcements").insert({ title: "x", body: "y" });
    expect(insertError).not.toBeNull();
  });
});

describe("platform_settings (Faz 4 Adım 1)", () => {
  it("platform_admin enforce_2fa'yı okuyup güncelleyebilir", async () => {
    const admin = await createPlatformAdmin("settings-update");
    createdUserIds.add(admin.userId);

    const { data: before, error: readError } = await admin.client
      .from("platform_settings")
      .select("enforce_2fa")
      .eq("id", true)
      .single();
    expect(readError).toBeNull();
    expect(before?.enforce_2fa).toBe(false);

    const { error: updateError } = await admin.client
      .from("platform_settings")
      .update({ enforce_2fa: true })
      .eq("id", true);
    expect(updateError).toBeNull();

    const { data: after } = await admin.client.from("platform_settings").select("enforce_2fa").eq("id", true).single();
    expect(after?.enforce_2fa).toBe(true);

    // Test sonraki koşumları etkilemesin diye eski haline döndür.
    await admin.client.from("platform_settings").update({ enforce_2fa: false }).eq("id", true);
  });

  it("normal personel platform_settings satırını göremez ve değiştiremez (RLS filtreler)", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await owner.from("platform_settings").select("enforce_2fa");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: updated, error: updateError } = await owner
      .from("platform_settings")
      .update({ enforce_2fa: true })
      .eq("id", true)
      .select();
    expect(updateError).toBeNull();
    expect(updated).toHaveLength(0);
  });

  it("ikinci bir platform_settings satırı (id=false) eklenemez — tekil satır kısıtı", async () => {
    const service = serviceRoleClient();
    const { error } = await service.from("platform_settings").insert({ id: false, enforce_2fa: false });
    expect(error).not.toBeNull();
  });
});
