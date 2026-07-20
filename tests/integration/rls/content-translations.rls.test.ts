import { describe, expect, it } from "vitest";

import { SEED, signInAsSeededOwner } from "../../helpers/testClients";

const BETA_PRODUCT_ID = "00000000-0000-4000-8000-000000000204";

describe("RLS: content_translations", () => {
  it("acme owner sadece kendi tenant'ının çevirilerini görür", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("content_translations").select("tenant_id");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data?.every((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);
  });

  it("acme owner, beta'nın ürünü için beta tenant_id'siyle çeviri INSERT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await acme.from("content_translations").insert({
      tenant_id: SEED.beta.tenantId,
      entity_type: "product",
      entity_id: BETA_PRODUCT_ID,
      locale: "tr",
      field: "description",
      value: "sızma denemesi",
    });

    expect(error).not.toBeNull();
  });
});
