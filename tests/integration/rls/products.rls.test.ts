import { describe, expect, it } from "vitest";

import { SEED, signInAsSeededOwner } from "../../helpers/testClients";

const BETA_PRODUCT_ID = "00000000-0000-4000-8000-000000000204";
const ACME_CATEGORY_ID = "00000000-0000-4000-8000-000000000101";

describe("RLS: products", () => {
  it("acme owner sadece kendi ürünlerini görür", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("products").select("tenant_id");

    expect(error).toBeNull();
    // Seed'i takip eder (Faz 21 demo genişletmesi: 3 → 16). Sayı, RLS'in
    // "eksik satır" ucunu korur; "sızan satır" ucunu aşağıdaki every() korur.
    expect(data).toHaveLength(16);
    expect(data?.every((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);
  });

  it("acme owner, beta'nın ürününü id ile SELECT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("products").select("id").eq("id", BETA_PRODUCT_ID);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("acme owner, beta'nın tenant_id'siyle yeni ürün INSERT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await acme
      .from("products")
      .insert({ tenant_id: SEED.beta.tenantId, category_id: ACME_CATEGORY_ID, base_price_minor: 1000 });

    expect(error).not.toBeNull();
  });
});
