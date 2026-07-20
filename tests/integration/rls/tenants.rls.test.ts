import { describe, expect, it } from "vitest";

import { SEED, signInAsSeededOwner } from "../../helpers/testClients";

describe("RLS: tenants", () => {
  it("acme owner sadece kendi tenant'ını görür", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("tenants").select("id,slug");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].slug).toBe("acme");
  });

  it("acme owner, beta tenant'ını id ile SELECT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("tenants").select("id").eq("id", SEED.beta.tenantId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("acme owner, beta tenant'ını UPDATE edemez (0 satır etkilenir)", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme
      .from("tenants")
      .update({ name: "hacked" })
      .eq("id", SEED.beta.tenantId)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
