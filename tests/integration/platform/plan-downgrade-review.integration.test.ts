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
});

async function planId(key: "starter" | "pro" | "unlimited") {
  const { data } = await serviceRoleClient().from("plans").select("id").eq("key", key).single();
  return data!.id as string;
}

describe("assign_tenant_plan → apply_plan_change (Faz 4 revizyonu Adım 5, S54)", () => {
  it("yalnızca platform_admin çağırabilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner.rpc("assign_tenant_plan", {
      p_tenant_id: SEED.acme.tenantId,
      p_plan_id: await planId("pro"),
    });
    expect(error).not.toBeNull();
  });

  it("bilinmeyen tenant için hata verir", async () => {
    const admin = await createPlatformAdmin("assign-plan-unknown");
    createdUserIds.add(admin.userId);
    const { error } = await admin.client.rpc("assign_tenant_plan", {
      p_tenant_id: crypto.randomUUID(),
      p_plan_id: await planId("starter"),
    });
    expect(error).not.toBeNull();
  });

  it("düşürmede plandan gelen fazla modülü pending_removal_since ile işaretler, paid_addon'a dokunmaz", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("assign-plan-downgrade");
    createdTenantIds.add(throwaway.tenantId);
    const admin = await createPlatformAdmin("assign-plan-downgrade");
    createdUserIds.add(admin.userId);

    const proId = await planId("pro");
    const starterId = await planId("starter");

    const { error: upgradeError } = await admin.client.rpc("assign_tenant_plan", {
      p_tenant_id: throwaway.tenantId,
      p_plan_id: proId,
    });
    expect(upgradeError).toBeNull();

    await service.from("tenant_modules").insert({
      tenant_id: throwaway.tenantId,
      module_key: "gift_cards",
      is_enabled: true,
      source: "paid_addon",
    });

    const { error: downgradeError } = await admin.client.rpc("assign_tenant_plan", {
      p_tenant_id: throwaway.tenantId,
      p_plan_id: starterId,
    });
    expect(downgradeError).toBeNull();

    const { data: tenant } = await service.from("tenants").select("plan_id").eq("id", throwaway.tenantId).single();
    expect(tenant?.plan_id).toBe(starterId);

    const { data: recipes } = await service
      .from("tenant_modules")
      .select("pending_removal_since, is_enabled")
      .eq("tenant_id", throwaway.tenantId)
      .eq("module_key", "recipes")
      .single();
    expect(recipes?.pending_removal_since).not.toBeNull();
    expect(recipes?.is_enabled).toBe(true);

    const { data: giftCards } = await service
      .from("tenant_modules")
      .select("pending_removal_since, source")
      .eq("tenant_id", throwaway.tenantId)
      .eq("module_key", "gift_cards")
      .single();
    expect(giftCards?.pending_removal_since).toBeNull();
    expect(giftCards?.source).toBe("paid_addon");
  });
});

describe("resolve_pending_module_removal RPC (Faz 4 revizyonu Adım 5, S54)", () => {
  async function setupPendingRemoval(prefix: string) {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant(prefix);
    createdTenantIds.add(throwaway.tenantId);
    const proId = await planId("pro");
    const starterId = await planId("starter");

    await service.rpc("apply_plan_change", { p_tenant_id: throwaway.tenantId, p_new_plan_id: proId });
    await service.rpc("apply_plan_change", { p_tenant_id: throwaway.tenantId, p_new_plan_id: starterId });

    return throwaway.tenantId;
  }

  it("yalnızca platform_admin çağırabilir", async () => {
    const tenantId = await setupPendingRemoval("resolve-forbidden");
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner.rpc("resolve_pending_module_removal", {
      p_tenant_id: tenantId,
      p_module_key: "recipes",
      p_keep: true,
    });
    expect(error).not.toBeNull();
  });

  it("'Koru' seçilirse modül source='granted' olur, pending_removal_since temizlenir, is_enabled kalır", async () => {
    const tenantId = await setupPendingRemoval("resolve-keep");
    const admin = await createPlatformAdmin("resolve-keep");
    createdUserIds.add(admin.userId);

    const { error } = await admin.client.rpc("resolve_pending_module_removal", {
      p_tenant_id: tenantId,
      p_module_key: "recipes",
      p_keep: true,
    });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: row } = await service
      .from("tenant_modules")
      .select("source, pending_removal_since, is_enabled")
      .eq("tenant_id", tenantId)
      .eq("module_key", "recipes")
      .single();
    expect(row?.source).toBe("granted");
    expect(row?.pending_removal_since).toBeNull();
    expect(row?.is_enabled).toBe(true);

    // Koru kararı kalıcı: sonraki bir düşürme bu satırı bir daha işaretlemez
    // (source artık 'plan' değil, apply_plan_change yalnızca 'plan' kaynaklı
    // satırları işaretler).
    const starterId = await planId("starter");
    await service.rpc("apply_plan_change", { p_tenant_id: tenantId, p_new_plan_id: starterId });
    const { data: afterAnotherDowngrade } = await service
      .from("tenant_modules")
      .select("pending_removal_since")
      .eq("tenant_id", tenantId)
      .eq("module_key", "recipes")
      .single();
    expect(afterAnotherDowngrade?.pending_removal_since).toBeNull();
  });

  it("'Kaldır' seçilirse modül is_enabled=false olur, pending_removal_since temizlenir", async () => {
    const tenantId = await setupPendingRemoval("resolve-remove");
    const admin = await createPlatformAdmin("resolve-remove");
    createdUserIds.add(admin.userId);

    const { error } = await admin.client.rpc("resolve_pending_module_removal", {
      p_tenant_id: tenantId,
      p_module_key: "recipes",
      p_keep: false,
    });
    expect(error).toBeNull();

    const { data: row } = await serviceRoleClient()
      .from("tenant_modules")
      .select("is_enabled, pending_removal_since")
      .eq("tenant_id", tenantId)
      .eq("module_key", "recipes")
      .single();
    expect(row?.is_enabled).toBe(false);
    expect(row?.pending_removal_since).toBeNull();
  });

  it("bekleyen kaldırma olmayan bir modül için hata verir", async () => {
    const throwaway = await createThrowawayTenant("resolve-no-pending");
    createdTenantIds.add(throwaway.tenantId);
    const admin = await createPlatformAdmin("resolve-no-pending");
    createdUserIds.add(admin.userId);

    const { error } = await admin.client.rpc("resolve_pending_module_removal", {
      p_tenant_id: throwaway.tenantId,
      p_module_key: "recipes",
      p_keep: true,
    });
    expect(error).not.toBeNull();
  });
});

describe("kendi kendine plan değişikliği ödeme akışı (Faz 4 revizyonu Adım 5, S54)", () => {
  it("set_subscription_checkout_ref(p_plan_id) + activate_subscription: ödeme sonrası yeni plan apply_plan_change ile uygulanır", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("billing-plan-change");
    createdTenantIds.add(throwaway.tenantId);
    const owner = await signInAsSeededOwner(throwaway.email);

    const starterId = await planId("starter");
    await service.from("tenants").update({ plan_id: starterId }).eq("id", throwaway.tenantId);
    await service.rpc("seed_tenant_modules_from_plan", { p_tenant_id: throwaway.tenantId });

    const proId = await planId("pro");
    const providerRef = crypto.randomUUID();
    const { error: refError } = await owner.rpc("set_subscription_checkout_ref", {
      p_provider: "mock",
      p_provider_ref: providerRef,
      p_plan_id: proId,
    });
    expect(refError).toBeNull();

    const { error: activateError } = await service.rpc("activate_subscription", {
      p_provider: "mock",
      p_provider_ref: providerRef,
    });
    expect(activateError).toBeNull();

    const { data: tenant } = await service.from("tenants").select("plan_id").eq("id", throwaway.tenantId).single();
    expect(tenant?.plan_id).toBe(proId);

    const { data: subscription } = await service
      .from("subscriptions")
      .select("pending_plan_id")
      .eq("tenant_id", throwaway.tenantId)
      .single();
    expect(subscription?.pending_plan_id).toBeNull();

    const { data: modules } = await service
      .from("tenant_modules")
      .select("module_key")
      .eq("tenant_id", throwaway.tenantId);
    expect(modules!.map((m) => m.module_key).sort()).toEqual(
      ["campaigns", "crm_loyalty", "delivery", "inventory", "pickup", "pos_cash", "recipes", "reservations", "staff_scheduling"].sort(),
    );

    // İkinci kez aynı provider_ref ile gelen webhook (retry) no-op olmalı —
    // pending_plan_id zaten null, apply_plan_change tekrar çağrılmaz.
    const { error: retryError } = await service.rpc("activate_subscription", {
      p_provider: "mock",
      p_provider_ref: providerRef,
    });
    expect(retryError).toBeNull();
  });
});
