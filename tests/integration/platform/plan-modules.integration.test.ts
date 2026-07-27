import { afterAll, describe, expect, it } from "vitest";

import { createThrowawayTenant, serviceRoleClient } from "../../helpers/testClients";

const createdTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of createdTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function planId(key: "starter" | "pro" | "unlimited") {
  const { data } = await serviceRoleClient().from("plans").select("id").eq("key", key).single();
  return data!.id as string;
}

describe("seed_tenant_modules_from_plan / apply_plan_change (Faz 4 revizyonu Adım 0)", () => {
  it("seed_tenant_modules_from_plan tenant'ın planına ait modülleri source='plan' ile açar", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("seed-plan");
    createdTenantIds.add(throwaway.tenantId);

    const starterId = await planId("starter");
    await service.from("tenants").update({ plan_id: starterId }).eq("id", throwaway.tenantId);

    const { error } = await service.rpc("seed_tenant_modules_from_plan", { p_tenant_id: throwaway.tenantId });
    expect(error).toBeNull();

    const { data: modules } = await service
      .from("tenant_modules")
      .select("module_key, is_enabled, source")
      .eq("tenant_id", throwaway.tenantId)
      .order("module_key");

    const keys = modules!.map((m) => m.module_key).sort();
    expect(keys).toEqual(["inventory", "pos_cash"]);
    expect(modules!.every((m) => m.is_enabled && m.source === "plan")).toBe(true);
  });

  it("apply_plan_change: düşürmede plandan gelen fazla modülü pending_removal_since ile işaretler, paid_addon'a dokunmaz, yükseltmede işareti temizler", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("apply-plan-change");
    createdTenantIds.add(throwaway.tenantId);

    const starterId = await planId("starter");
    const proId = await planId("pro");

    // Pro'ya yükselt: pro'nun tüm modülleri source='plan' ile açılır.
    const { error: upgradeError } = await service.rpc("apply_plan_change", {
      p_tenant_id: throwaway.tenantId,
      p_new_plan_id: proId,
    });
    expect(upgradeError).toBeNull();

    const { data: tenantAfterUpgrade } = await service
      .from("tenants")
      .select("plan_id")
      .eq("id", throwaway.tenantId)
      .single();
    expect(tenantAfterUpgrade?.plan_id).toBe(proId);

    const { data: proModules } = await service
      .from("tenant_modules")
      .select("module_key")
      .eq("tenant_id", throwaway.tenantId);
    expect(proModules!.map((m) => m.module_key).sort()).toEqual(
      ["campaigns", "crm_loyalty", "delivery", "inventory", "pickup", "pos_cash", "recipes", "reservations", "staff_scheduling"].sort(),
    );

    // Pro planındayken ayrıca ücretli bir eklenti satın alınmış gibi simüle et
    // (gift_cards pro'nun standart modülleri arasında değil).
    await service.from("tenant_modules").insert({
      tenant_id: throwaway.tenantId,
      module_key: "gift_cards",
      is_enabled: true,
      source: "paid_addon",
    });

    // Starter'a düşür: pro'nun starter'da olmayan modülleri (recipes,
    // crm_loyalty, campaigns, pickup, delivery, reservations,
    // staff_scheduling) pending_removal_since ile işaretlenir, silinmez.
    const { error: downgradeError } = await service.rpc("apply_plan_change", {
      p_tenant_id: throwaway.tenantId,
      p_new_plan_id: starterId,
    });
    expect(downgradeError).toBeNull();

    const { data: afterDowngrade } = await service
      .from("tenant_modules")
      .select("module_key, source, is_enabled, pending_removal_since")
      .eq("tenant_id", throwaway.tenantId);

    const byKey = new Map(afterDowngrade!.map((m) => [m.module_key, m]));

    for (const key of ["recipes", "crm_loyalty", "campaigns", "pickup", "delivery", "reservations", "staff_scheduling"]) {
      expect(byKey.get(key)?.pending_removal_since, `${key} pending_removal_since dolmalı`).not.toBeNull();
      expect(byKey.get(key)?.is_enabled, `${key} hâlâ açık kalmalı (silinmedi)`).toBe(true);
    }
    expect(byKey.get("pos_cash")?.pending_removal_since).toBeNull();
    expect(byKey.get("inventory")?.pending_removal_since).toBeNull();
    expect(byKey.get("gift_cards")?.source).toBe("paid_addon");
    expect(byKey.get("gift_cards")?.pending_removal_since).toBeNull();
    expect(byKey.get("gift_cards")?.is_enabled).toBe(true);

    // Tekrar Pro'ya yükselt: daha önce işaretlenen modüllerin
    // pending_removal_since'i temizlenir (geri-yükseltme), paid_addon
    // hiç etkilenmez.
    const { error: reUpgradeError } = await service.rpc("apply_plan_change", {
      p_tenant_id: throwaway.tenantId,
      p_new_plan_id: proId,
    });
    expect(reUpgradeError).toBeNull();

    const { data: afterReUpgrade } = await service
      .from("tenant_modules")
      .select("module_key, source, pending_removal_since")
      .eq("tenant_id", throwaway.tenantId);
    const byKeyAfterReUpgrade = new Map(afterReUpgrade!.map((m) => [m.module_key, m]));

    for (const key of ["recipes", "crm_loyalty", "campaigns", "pickup", "delivery", "reservations", "staff_scheduling"]) {
      expect(byKeyAfterReUpgrade.get(key)?.pending_removal_since, `${key} yükseltmede temizlenmeli`).toBeNull();
    }
    expect(byKeyAfterReUpgrade.get("gift_cards")?.source).toBe("paid_addon");
    expect(byKeyAfterReUpgrade.get("gift_cards")?.pending_removal_since).toBeNull();
  });
});
