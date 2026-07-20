import { describe, expect, it } from "vitest";

import { SEED, signInAsSeededOwner } from "../../helpers/testClients";

describe("RLS: generic_qr_codes", () => {
  it("acme owner sadece kendi genel QR'ını görür", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("generic_qr_codes").select("tenant_id");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].tenant_id).toBe(SEED.acme.tenantId);
  });

  it("acme owner, beta'nın tenant_id'siyle yeni genel QR INSERT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await acme.from("generic_qr_codes").insert({
      tenant_id: SEED.beta.tenantId,
      branch_id: SEED.beta.branchId,
      qr_token_hash: "y".repeat(64),
    });

    expect(error).not.toBeNull();
  });
});
