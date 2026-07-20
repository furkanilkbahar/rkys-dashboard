import { describe, expect, it } from "vitest";

import { SEED, signInAsSeededOwner } from "../../helpers/testClients";

describe("RLS: call_types", () => {
  it("acme owner sadece kendi çağrı tiplerini görür", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("call_types").select("tenant_id");

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    expect(data?.every((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);
  });

  it("acme owner, beta'nın tenant_id'siyle yeni çağrı tipi INSERT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await acme.from("call_types").insert({ tenant_id: SEED.beta.tenantId, key: "sizma" });

    expect(error).not.toBeNull();
  });
});
