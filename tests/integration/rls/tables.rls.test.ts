import { describe, expect, it } from "vitest";

import { SEED, signInAsSeededOwner } from "../../helpers/testClients";

describe("RLS: tables", () => {
  it("acme owner sadece kendi masalarını görür", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("tables").select("tenant_id");

    expect(error).toBeNull();
    expect(data).toHaveLength(6); // Masa 1-5 + otomatik "Tezgâh" masası (Faz 3 Adım 0)
    expect(data?.every((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);
  });

  it("acme owner, beta'nın masasını id ile SELECT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("tables").select("id").eq("id", SEED.beta.table1Id);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("acme owner, beta'nın tenant_id'siyle yeni masa INSERT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await acme.from("tables").insert({
      tenant_id: SEED.beta.tenantId,
      branch_id: SEED.beta.branchId,
      label: "sızma denemesi",
      qr_token_hash: "x".repeat(64),
    });

    expect(error).not.toBeNull();
  });
});
