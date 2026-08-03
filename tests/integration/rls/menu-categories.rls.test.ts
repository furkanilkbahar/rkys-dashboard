import { describe, expect, it } from "vitest";

import { SEED, signInAsSeededOwner } from "../../helpers/testClients";

const BETA_CATEGORY_ID = "00000000-0000-4000-8000-000000000103";

describe("RLS: menu_categories", () => {
  it("acme owner sadece kendi kategorilerini görür", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("menu_categories").select("tenant_id");

    expect(error).toBeNull();
    // Seed'i takip eder (Faz 21 demo genişletmesi: 2 → 6).
    expect(data).toHaveLength(6);
    expect(data?.every((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);
  });

  it("acme owner, beta'nın kategorisini id ile SELECT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("menu_categories").select("id").eq("id", BETA_CATEGORY_ID);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("acme owner, beta'nın tenant_id'siyle yeni kategori INSERT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await acme.from("menu_categories").insert({ tenant_id: SEED.beta.tenantId });

    expect(error).not.toBeNull();
  });
});
