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

describe("set_tenant_module RPC (Faz 4 revizyonu Adım 4, S53)", () => {
  it("yalnızca platform_admin çağırabilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner.rpc("set_tenant_module", {
      p_tenant_id: SEED.acme.tenantId,
      p_module_key: "kiosk",
      p_is_enabled: true,
      p_source: "granted",
    });
    expect(error).not.toBeNull();
  });

  it("platform_admin daha önce hiç satırı olmayan bir modülü 'granted' kaynağıyla açabilir", async () => {
    const throwaway = await createThrowawayTenant("set-module-new");
    createdTenantIds.add(throwaway.tenantId);
    const admin = await createPlatformAdmin("set-module-new");
    createdUserIds.add(admin.userId);

    const { error } = await admin.client.rpc("set_tenant_module", {
      p_tenant_id: throwaway.tenantId,
      p_module_key: "kiosk",
      p_is_enabled: true,
      p_source: "granted",
    });
    expect(error).toBeNull();

    const { data: row } = await serviceRoleClient()
      .from("tenant_modules")
      .select("is_enabled, source")
      .eq("tenant_id", throwaway.tenantId)
      .eq("module_key", "kiosk")
      .single();
    expect(row?.is_enabled).toBe(true);
    expect(row?.source).toBe("granted");
  });

  it("mevcut bir satırın is_enabled/source değerini upsert ile günceller, plan değişikliği bu satırı etkilemez", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("set-module-upsert");
    createdTenantIds.add(throwaway.tenantId);
    const admin = await createPlatformAdmin("set-module-upsert");
    createdUserIds.add(admin.userId);

    const { data: starterPlan } = await service.from("plans").select("id").eq("key", "starter").single();
    await service.from("tenants").update({ plan_id: starterPlan!.id }).eq("id", throwaway.tenantId);
    await service.rpc("seed_tenant_modules_from_plan", { p_tenant_id: throwaway.tenantId });

    // pos_cash starter planından geldi (source='plan'); platform admin bunu
    // elle 'paid_addon' olarak yeniden etiketliyor.
    const { error } = await admin.client.rpc("set_tenant_module", {
      p_tenant_id: throwaway.tenantId,
      p_module_key: "pos_cash",
      p_is_enabled: true,
      p_source: "paid_addon",
    });
    expect(error).toBeNull();

    const { data: row } = await service
      .from("tenant_modules")
      .select("is_enabled, source")
      .eq("tenant_id", throwaway.tenantId)
      .eq("module_key", "pos_cash")
      .single();
    expect(row?.source).toBe("paid_addon");

    // apply_plan_change (starter -> starter, no-op plan) source='plan'
    // OLMAYAN bu satıra dokunmamalı.
    await service.rpc("apply_plan_change", { p_tenant_id: throwaway.tenantId, p_new_plan_id: starterPlan!.id });
    const { data: afterPlanChange } = await service
      .from("tenant_modules")
      .select("source, pending_removal_since")
      .eq("tenant_id", throwaway.tenantId)
      .eq("module_key", "pos_cash")
      .single();
    expect(afterPlanChange?.source).toBe("paid_addon");
    expect(afterPlanChange?.pending_removal_since).toBeNull();
  });

  it("bilinmeyen module_key için CHECK constraint hatası döner", async () => {
    const throwaway = await createThrowawayTenant("set-module-invalid");
    createdTenantIds.add(throwaway.tenantId);
    const admin = await createPlatformAdmin("set-module-invalid");
    createdUserIds.add(admin.userId);

    const { error } = await admin.client.rpc("set_tenant_module", {
      p_tenant_id: throwaway.tenantId,
      p_module_key: "not_a_real_module",
      p_is_enabled: true,
      p_source: "granted",
    });
    expect(error).not.toBeNull();
  });
});
