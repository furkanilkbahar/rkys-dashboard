import { describe, expect, it } from "vitest";

import { SEED, signInAsSeededOwner } from "../../helpers/testClients";

const ACME_LATTE_PRODUCT_ID = "00000000-0000-4000-8000-000000000202";

describe("RLS: product_variants", () => {
  it("acme owner sadece kendi varyantlarını görür", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("product_variants").select("tenant_id");

    expect(error).toBeNull();
    // Seed'i takip eder (Faz 21: Latte 2 + Türk Kahvesi 3 + Cold Brew 2).
    expect(data).toHaveLength(7);
    expect(data?.every((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);
  });

  it("acme owner, beta'nın tenant_id'siyle yeni varyant INSERT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await acme.from("product_variants").insert({
      tenant_id: SEED.beta.tenantId,
      product_id: ACME_LATTE_PRODUCT_ID,
      price_minor: 5000,
    });

    expect(error).not.toBeNull();
  });
});
