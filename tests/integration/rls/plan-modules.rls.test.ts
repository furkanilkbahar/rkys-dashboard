import { describe, expect, it } from "vitest";

import { SEED, signInAsSeededOwner } from "../../helpers/testClients";

describe("RLS: plan_modules (Faz 4 revizyonu Adım 0)", () => {
  it("herkes plan_modules'ı okuyabilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await owner.from("plan_modules").select("plan_id, module_key");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it("tenant personeli plan_modules'a yazamaz (yalnızca platform_admin)", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: anyPlan } = await owner.from("plan_modules").select("plan_id, module_key").limit(1).single();

    const { error: insertError } = await owner
      .from("plan_modules")
      .insert({ plan_id: anyPlan!.plan_id, module_key: "kiosk" })
      .select();
    expect(insertError).not.toBeNull();

    const { error: deleteError, data: deleteData } = await owner
      .from("plan_modules")
      .delete()
      .eq("plan_id", anyPlan!.plan_id)
      .eq("module_key", anyPlan!.module_key)
      .select();
    expect(deleteError).toBeNull();
    expect(deleteData).toHaveLength(0);
  });
});
