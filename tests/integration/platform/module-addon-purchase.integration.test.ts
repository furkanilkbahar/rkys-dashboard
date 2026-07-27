import { afterAll, describe, expect, it } from "vitest";

import { createPlatformAdmin, createThrowawayTenant, SEED, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

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
  await service.from("module_addon_prices").delete().eq("module_key", "kiosk");
});

describe("set_module_addon_price RPC (Faz 15 Adım 0/2, S62/S64)", () => {
  it("yalnızca platform_admin çağırabilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner.rpc("set_module_addon_price", { p_module_key: "kiosk", p_price_minor: 50000 });
    expect(error).not.toBeNull();
  });

  it("platform_admin bir modülün à la carte fiyatını ayarlayabilir (upsert)", async () => {
    const admin = await createPlatformAdmin("addon-price-set");
    createdUserIds.add(admin.userId);

    const { error: firstError } = await admin.client.rpc("set_module_addon_price", {
      p_module_key: "kiosk",
      p_price_minor: 50000,
    });
    expect(firstError).toBeNull();

    const service = serviceRoleClient();
    const { data: firstRow } = await service.from("module_addon_prices").select("price_minor").eq("module_key", "kiosk").single();
    expect(firstRow?.price_minor).toBe(50000);

    const { error: secondError } = await admin.client.rpc("set_module_addon_price", {
      p_module_key: "kiosk",
      p_price_minor: 75000,
    });
    expect(secondError).toBeNull();

    const { data: secondRow } = await service.from("module_addon_prices").select("price_minor").eq("module_key", "kiosk").single();
    expect(secondRow?.price_minor).toBe(75000);
  });

  it("herkes (staff dahil) fiyatları okuyabilir ama yazamaz", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await owner.from("module_addon_prices").select("module_key, price_minor");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);

    const { error: writeError, data: writeData } = await owner
      .from("module_addon_prices")
      .update({ price_minor: 1 })
      .eq("module_key", "kiosk")
      .select();
    expect(writeError).toBeNull();
    expect(writeData).toHaveLength(0);
  });
});

describe("ücretli ek modül satın alma akışı: set_subscription_checkout_ref + activate_subscription (Faz 15 Adım 0/1, S62/S63)", () => {
  it("ödeme onaylanınca modül source='paid_addon' ile açılır, pending_addon_module_key temizlenir", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("addon-purchase");
    createdTenantIds.add(throwaway.tenantId);
    const owner = await signInAsSeededOwner(throwaway.email);

    const providerRef = crypto.randomUUID();
    const { error: refError } = await owner.rpc("set_subscription_checkout_ref", {
      p_provider: "mock",
      p_provider_ref: providerRef,
      p_plan_id: null as unknown as string,
      p_addon_module_key: "kiosk",
    });
    expect(refError).toBeNull();

    const { data: pending } = await service
      .from("subscriptions")
      .select("pending_addon_module_key")
      .eq("tenant_id", throwaway.tenantId)
      .single();
    expect(pending?.pending_addon_module_key).toBe("kiosk");

    const { error: activateError } = await service.rpc("activate_subscription", {
      p_provider: "mock",
      p_provider_ref: providerRef,
    });
    expect(activateError).toBeNull();

    const { data: moduleRow } = await service
      .from("tenant_modules")
      .select("is_enabled, source")
      .eq("tenant_id", throwaway.tenantId)
      .eq("module_key", "kiosk")
      .single();
    expect(moduleRow?.is_enabled).toBe(true);
    expect(moduleRow?.source).toBe("paid_addon");

    const { data: afterActivate } = await service
      .from("subscriptions")
      .select("pending_addon_module_key")
      .eq("tenant_id", throwaway.tenantId)
      .single();
    expect(afterActivate?.pending_addon_module_key).toBeNull();
  });

  it("paid_addon olarak açılan modül, sonraki plan düşürmede işaretlenmez", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("addon-downgrade-safe");
    createdTenantIds.add(throwaway.tenantId);

    const { data: proPlan } = await service.from("plans").select("id").eq("key", "pro").single();
    const { data: starterPlan } = await service.from("plans").select("id").eq("key", "starter").single();
    await service.rpc("apply_plan_change", { p_tenant_id: throwaway.tenantId, p_new_plan_id: proPlan!.id });

    const owner = await signInAsSeededOwner(throwaway.email);
    const providerRef = crypto.randomUUID();
    await owner.rpc("set_subscription_checkout_ref", {
      p_provider: "mock",
      p_provider_ref: providerRef,
      p_plan_id: null as unknown as string,
      p_addon_module_key: "kiosk",
    });
    await service.rpc("activate_subscription", { p_provider: "mock", p_provider_ref: providerRef });

    // pro -> starter düşürmesi: kiosk zaten pro'da da yok, ama paid_addon
    // olarak açık kaldığından apply_plan_change bir daha hiç dokunmamalı.
    await service.rpc("apply_plan_change", { p_tenant_id: throwaway.tenantId, p_new_plan_id: starterPlan!.id });

    const { data: moduleRow } = await service
      .from("tenant_modules")
      .select("is_enabled, source, pending_removal_since")
      .eq("tenant_id", throwaway.tenantId)
      .eq("module_key", "kiosk")
      .single();
    expect(moduleRow?.is_enabled).toBe(true);
    expect(moduleRow?.source).toBe("paid_addon");
    expect(moduleRow?.pending_removal_since).toBeNull();
  });

  it("bilinmeyen provider_ref için activate_subscription hata verir (regresyon)", async () => {
    const service = serviceRoleClient();
    const { error } = await service.rpc("activate_subscription", { p_provider: "mock", p_provider_ref: crypto.randomUUID() });
    expect(error).not.toBeNull();
  });
});
