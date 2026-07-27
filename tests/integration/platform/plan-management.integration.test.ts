import { afterAll, describe, expect, it } from "vitest";

import { createPlatformAdmin, SEED, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const createdUserIds = new Set<string>();
const createdPlanIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of createdPlanIds) {
    await service.from("plans").delete().eq("id", id);
  }
  for (const id of createdUserIds) {
    await service.auth.admin.deleteUser(id);
  }
});

describe("create_plan / update_plan / set_plan_module RPC'leri (Faz 4 revizyonu Adım 1, S50)", () => {
  it("yalnızca platform_admin yeni plan oluşturabilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error: forbiddenError } = await owner.rpc("create_plan", {
      p_key: `deny-${crypto.randomUUID().slice(0, 8)}`,
      p_name: "Denenmiş",
      p_price_minor: 100,
      p_table_limit: 5,
      p_included_branch_count: 1,
      p_extra_branch_price_minor: 0,
    });
    expect(forbiddenError).not.toBeNull();
  });

  it("platform_admin yeni bir plan açabilir, modüllerini işaretleyebilir, fiyat/limitlerini günceller", async () => {
    const admin = await createPlatformAdmin("plan-crud");
    createdUserIds.add(admin.userId);

    const key = `test-${crypto.randomUUID().slice(0, 8)}`;
    const { data: planId, error: createError } = await admin.client.rpc("create_plan", {
      p_key: key,
      p_name: "Test Planı",
      p_price_minor: 12300,
      p_table_limit: 7,
      p_included_branch_count: 1,
      p_extra_branch_price_minor: 4500,
    });
    expect(createError).toBeNull();
    expect(planId).toBeTruthy();
    createdPlanIds.add(planId as string);

    const service = serviceRoleClient();
    const { data: created } = await service.from("plans").select("*").eq("id", planId as string).single();
    expect(created?.key).toBe(key);
    expect(created?.price_minor).toBe(12300);
    expect(created?.table_limit).toBe(7);

    const { error: moduleError } = await admin.client.rpc("set_plan_module", {
      p_plan_id: planId as string,
      p_module_key: "kiosk",
      p_included: true,
    });
    expect(moduleError).toBeNull();

    const { data: moduleRow } = await service
      .from("plan_modules")
      .select("module_key")
      .eq("plan_id", planId as string)
      .eq("module_key", "kiosk")
      .maybeSingle();
    expect(moduleRow).not.toBeNull();

    const { error: removeModuleError } = await admin.client.rpc("set_plan_module", {
      p_plan_id: planId as string,
      p_module_key: "kiosk",
      p_included: false,
    });
    expect(removeModuleError).toBeNull();

    const { data: removedModuleRow } = await service
      .from("plan_modules")
      .select("module_key")
      .eq("plan_id", planId as string)
      .eq("module_key", "kiosk")
      .maybeSingle();
    expect(removedModuleRow).toBeNull();

    const { error: updateError } = await admin.client.rpc("update_plan", {
      p_plan_id: planId as string,
      p_name: "Test Planı v2",
      p_price_minor: 15000,
      p_table_limit: null as unknown as number,
      p_included_branch_count: 2,
      p_extra_branch_price_minor: 6000,
    });
    expect(updateError).toBeNull();

    const { data: updated } = await service.from("plans").select("*").eq("id", planId as string).single();
    expect(updated?.name).toBe("Test Planı v2");
    expect(updated?.price_minor).toBe(15000);
    expect(updated?.table_limit).toBeNull();
    expect(updated?.included_branch_count).toBe(2);
    expect(updated?.extra_branch_price_minor).toBe(6000);
  });

  it("yalnızca platform_admin update_plan/set_plan_module çağırabilir", async () => {
    const service = serviceRoleClient();
    const { data: starterPlan } = await service.from("plans").select("id").eq("key", "starter").single();

    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error: updateForbidden } = await owner.rpc("update_plan", {
      p_plan_id: starterPlan!.id,
      p_name: "hacked",
      p_price_minor: 0,
      p_table_limit: 1,
      p_included_branch_count: 1,
      p_extra_branch_price_minor: 0,
    });
    expect(updateForbidden).not.toBeNull();

    const { error: moduleForbidden } = await owner.rpc("set_plan_module", {
      p_plan_id: starterPlan!.id,
      p_module_key: "api_access",
      p_included: true,
    });
    expect(moduleForbidden).not.toBeNull();
  });
});
