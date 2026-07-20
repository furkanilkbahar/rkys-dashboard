import { describe, expect, it } from "vitest";

import { SEED, signInAsSeededOwner } from "../../helpers/testClients";

const BETA_PRODUCT_ID = "00000000-0000-4000-8000-000000000204";

describe("RLS: branch_product_overrides", () => {
  it("acme owner, beta şubesi+ürünü için (beta'nın kendi tenant_id'siyle) override INSERT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await acme.from("branch_product_overrides").insert({
      tenant_id: SEED.beta.tenantId,
      branch_id: SEED.beta.branchId,
      product_id: BETA_PRODUCT_ID,
      is_available: false,
    });

    expect(error).not.toBeNull();
  });

  it("acme owner, kendi tenant_id'siyle override yazabilir (ve silebilir)", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme
      .from("branch_product_overrides")
      .insert({
        tenant_id: SEED.acme.tenantId,
        branch_id: SEED.acme.branchId,
        product_id: "00000000-0000-4000-8000-000000000201",
        is_available: false,
      })
      .select("id")
      .single();

    expect(error).toBeNull();

    // Test tekrar tekrar çalıştırılabilir olsun diye eklenen satır temizlenir.
    await acme.from("branch_product_overrides").delete().eq("id", data!.id);
  });
});
