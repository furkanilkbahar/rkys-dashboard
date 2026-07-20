import { describe, expect, it } from "vitest";

import { SEED, signInAsSeededOwner } from "../../helpers/testClients";

describe("RLS: branches", () => {
  it("acme owner sadece kendi şubesini görür", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("branches").select("id,tenant_id");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].tenant_id).toBe(SEED.acme.tenantId);
  });

  it("acme owner, beta'nın şubesini id ile SELECT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("branches").select("id").eq("id", SEED.beta.branchId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("acme owner, beta'nın tenant_id'siyle yeni şube INSERT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await acme
      .from("branches")
      .insert({ tenant_id: SEED.beta.tenantId, name: "sızma denemesi" });

    // RLS WITH CHECK ihlali → policy hatası (satır sessizce yazılmaz).
    expect(error).not.toBeNull();
  });
});
