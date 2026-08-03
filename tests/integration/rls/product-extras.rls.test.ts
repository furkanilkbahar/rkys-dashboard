import { describe, expect, it } from "vitest";

import { SEED, signInAsSeededOwner } from "../../helpers/testClients";

const ACME_CHEESECAKE_PRODUCT_ID = "00000000-0000-4000-8000-000000000203";

describe("RLS: product_extras", () => {
  it("acme owner sadece kendi ekstralarını görür", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("product_extras").select("tenant_id");

    expect(error).toBeNull();
    // Seed'i takip eder (Faz 21: Cheesecake 2 + Latte 3 + Kaşarlı Tost 2).
    expect(data).toHaveLength(7);
    expect(data?.every((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);
  });

  it("acme owner, beta'nın tenant_id'siyle yeni ekstra INSERT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await acme.from("product_extras").insert({
      tenant_id: SEED.beta.tenantId,
      product_id: ACME_CHEESECAKE_PRODUCT_ID,
      price_minor: 1000,
    });

    expect(error).not.toBeNull();
  });
});
