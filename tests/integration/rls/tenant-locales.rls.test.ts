import { describe, expect, it } from "vitest";

import { SEED, signInAsSeededOwner } from "../../helpers/testClients";

describe("RLS: tenant_locales", () => {
  it("acme owner sadece kendi tenant'ının dillerini görür", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("tenant_locales").select("tenant_id,locale");

    expect(error).toBeNull();
    expect(data?.every((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);
    expect(data?.map((row) => row.locale).sort()).toEqual(["en", "tr"]);
  });

  it("acme owner, beta'nın dilini UPDATE edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme
      .from("tenant_locales")
      .update({ is_default: false })
      .eq("tenant_id", SEED.beta.tenantId)
      .select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
