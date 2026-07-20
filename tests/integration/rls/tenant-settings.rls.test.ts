import { describe, expect, it } from "vitest";

import { SEED, signInAsSeededOwner } from "../../helpers/testClients";

describe("RLS: tenant_settings", () => {
  it("acme owner sadece kendi tenant ayarını görür", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("tenant_settings").select("tenant_id");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].tenant_id).toBe(SEED.acme.tenantId);
  });

  it("acme owner, beta'nın ayarını id ile SELECT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme
      .from("tenant_settings")
      .select("tenant_id")
      .eq("tenant_id", SEED.beta.tenantId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("acme owner, beta'nın ayarını UPDATE edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme
      .from("tenant_settings")
      .update({ order_mode: "approval" })
      .eq("tenant_id", SEED.beta.tenantId)
      .select("tenant_id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
