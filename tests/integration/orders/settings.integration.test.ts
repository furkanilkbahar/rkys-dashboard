import { describe, expect, it } from "vitest";

import { anonClient, SEED, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

describe("RPC/tablo: ayarlar", () => {
  it("staff sipariş ayarlarını günceller", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner
      .from("tenant_settings")
      .update({ order_mode: "approval", session_timeout_minutes: 90 })
      .eq("tenant_id", SEED.acme.tenantId);
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data } = await service
      .from("tenant_settings")
      .select("order_mode, session_timeout_minutes")
      .eq("tenant_id", SEED.acme.tenantId)
      .single();
    expect(data?.order_mode).toBe("approval");
    expect(data?.session_timeout_minutes).toBe(90);

    await owner.from("tenant_settings").update({ order_mode: "direct", session_timeout_minutes: 180 }).eq("tenant_id", SEED.acme.tenantId);
  });

  it("update_tenant_business_settings: owner işletme ayarlarını değiştirebilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner.rpc("update_tenant_business_settings", {
      p_currency: "USD",
      p_timezone: "Europe/London",
    });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data } = await service.from("tenants").select("currency, timezone").eq("id", SEED.acme.tenantId).single();
    expect(data?.currency).toBe("USD");
    expect(data?.timezone).toBe("Europe/London");

    await owner.rpc("update_tenant_business_settings", { p_currency: "TRY", p_timezone: "Europe/Istanbul" });
  });

  it("update_tenant_business_settings: owner olmayan reddedilir", async () => {
    const manager = await signInAsSeededOwner(SEED.acme.managerEmail);
    const { error } = await manager.rpc("update_tenant_business_settings", {
      p_currency: "USD",
      p_timezone: "Europe/London",
    });
    expect(error).not.toBeNull();
  });

  it("staff çağrı tipi oluşturup çevirisini yazabilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: callType, error } = await owner
      .from("call_types")
      .insert({ tenant_id: SEED.acme.tenantId, key: crypto.randomUUID(), is_active: true })
      .select("id")
      .single();
    expect(error).toBeNull();

    await owner.from("content_translations").upsert([
      { tenant_id: SEED.acme.tenantId, entity_type: "call_type", entity_id: callType!.id, locale: "tr", field: "name", value: "Su" },
      { tenant_id: SEED.acme.tenantId, entity_type: "call_type", entity_id: callType!.id, locale: "en", field: "name", value: "Water" },
    ]);

    const service = serviceRoleClient();
    const { data: translations } = await service
      .from("content_translations")
      .select("locale, value")
      .eq("entity_type", "call_type")
      .eq("entity_id", callType!.id);
    expect(translations?.find((t) => t.locale === "tr")?.value).toBe("Su");

    await service.from("content_translations").delete().eq("entity_type", "call_type").eq("entity_id", callType!.id);
    await service.from("call_types").delete().eq("id", callType!.id);
  });

  it("tip_presets: staff oluşturur, kendi tenant'ının satırlarını görür", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner
      .from("tip_presets")
      .insert({ tenant_id: SEED.acme.tenantId, label: "Standart", percentage: 10, is_active: true });
    expect(error).toBeNull();

    const { data, error: selectError } = await owner.from("tip_presets").select("tenant_id");
    expect(selectError).toBeNull();
    expect(data?.every((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);
    expect(data?.length).toBeGreaterThan(0);

    await serviceRoleClient().from("tip_presets").delete().eq("tenant_id", SEED.acme.tenantId).eq("label", "Standart");
  });

  it("tip_presets: acme owner, beta'nın tenant_id'siyle satır ekleyemez", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner
      .from("tip_presets")
      .insert({ tenant_id: SEED.beta.tenantId, label: "Yetkisiz", percentage: 10, is_active: true });
    expect(error).not.toBeNull();
  });

  it("rating_settings: staff günceller, eşik kolonu tabloda yok (kod-seviyeli sabit)", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner
      .from("rating_settings")
      .update({ is_enabled: true, google_review_url: "https://g.page/r/example" })
      .eq("tenant_id", SEED.acme.tenantId);
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data } = await service.from("rating_settings").select("is_enabled, google_review_url").eq("tenant_id", SEED.acme.tenantId).single();
    expect(data?.is_enabled).toBe(true);
    expect(data?.google_review_url).toBe("https://g.page/r/example");

    await owner.from("rating_settings").update({ is_enabled: false, google_review_url: null }).eq("tenant_id", SEED.acme.tenantId);
  });

  it("disable_tenant_locale: son etkin dil kapatılamaz", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    await owner.rpc("disable_tenant_locale", { p_locale: "en" });

    const { error } = await owner.rpc("disable_tenant_locale", { p_locale: "tr" });
    expect(error).not.toBeNull();

    await serviceRoleClient()
      .from("tenant_locales")
      .upsert({ tenant_id: SEED.acme.tenantId, locale: "en", is_default: false }, { onConflict: "tenant_id,locale" });
  });

  it("tenant_modules: staff modülü açıp kapatabilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner
      .from("tenant_modules")
      .upsert(
        { tenant_id: SEED.acme.tenantId, module_key: "reservations", is_enabled: true },
        { onConflict: "tenant_id,module_key" },
      );
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data } = await service
      .from("tenant_modules")
      .select("is_enabled")
      .eq("tenant_id", SEED.acme.tenantId)
      .eq("module_key", "reservations")
      .single();
    expect(data?.is_enabled).toBe(true);

    await owner
      .from("tenant_modules")
      .upsert(
        { tenant_id: SEED.acme.tenantId, module_key: "reservations", is_enabled: false },
        { onConflict: "tenant_id,module_key" },
      );
  });

  it("waiter (staff.manage benzeri sınırlı izin yok) yine de is_staff() olduğu için tenant_settings güncelleyebilir", async () => {
    // tenant_settings RLS'i is_staff() bazlı, permission-flag bazlı değil —
    // bu test mevcut davranışı belgeler (Faz 0'dan beri böyle).
    const waiter = await signInAsSeededOwner(SEED.acme.waiterEmail);
    const { error } = await waiter
      .from("tenant_settings")
      .update({ session_timeout_minutes: 200 })
      .eq("tenant_id", SEED.acme.tenantId);
    expect(error).toBeNull();

    await serviceRoleClient().from("tenant_settings").update({ session_timeout_minutes: 180 }).eq("tenant_id", SEED.acme.tenantId);
  });
});

describe("Tema yönetimi (Faz 6 Adım 4, S29)", () => {
  it("staff yalnızca public temaları görür", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await owner.from("themes").select("key, is_public");
    expect(error).toBeNull();
    expect(data!.every((t) => t.is_public)).toBe(true);
    expect(data!.map((t) => t.key)).toEqual(expect.arrayContaining(["gece", "kagit", "kor"]));
  });

  it("private (is_public=false) bir tema staff'a hiç görünmez", async () => {
    const service = serviceRoleClient();
    await service.from("themes").insert({ key: "test-private-theme", name: "Private", is_public: false });

    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data } = await owner.from("themes").select("key").eq("key", "test-private-theme");
    expect(data).toHaveLength(0);

    await service.from("themes").delete().eq("key", "test-private-theme");
  });

  it("staff tenant_settings.theme_key'i geçerli bir temaya değiştirebilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner.from("tenant_settings").update({ theme_key: "kor" }).eq("tenant_id", SEED.acme.tenantId);
    expect(error).toBeNull();

    const { data } = await serviceRoleClient().from("tenant_settings").select("theme_key").eq("tenant_id", SEED.acme.tenantId).single();
    expect(data?.theme_key).toBe("kor");

    await serviceRoleClient().from("tenant_settings").update({ theme_key: "kagit" }).eq("tenant_id", SEED.acme.tenantId);
  });

  it("themes'te bulunmayan bir theme_key FK kısıtına takılır", async () => {
    const { error } = await serviceRoleClient()
      .from("tenant_settings")
      .update({ theme_key: "does-not-exist" })
      .eq("tenant_id", SEED.acme.tenantId);
    expect(error).not.toBeNull();
  });

  it("resolve_tenant_by_domain tenant_theme_key'i döndürür", async () => {
    const service = serviceRoleClient();
    const { data: domainRow } = await service.from("tenant_domains").select("domain").eq("tenant_id", SEED.acme.tenantId).limit(1).single();

    const { data, error } = await anonClient().rpc("resolve_tenant_by_domain", { p_domain: domainRow!.domain });
    expect(error).toBeNull();
    expect(data![0].tenant_theme_key).toBe("kagit");
  });
});
