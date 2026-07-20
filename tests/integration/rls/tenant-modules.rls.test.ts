import { describe, expect, it } from "vitest";

import { SEED, signInAsSeededOwner } from "../../helpers/testClients";

describe("RLS: tenant_modules", () => {
  it("acme owner sadece kendi tenant'ının modül satırlarını görür", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("tenant_modules").select("tenant_id");

    expect(error).toBeNull();
    expect(data?.every((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);
  });

  it("acme owner, beta'nın modül satırlarını tenant_id filtresiyle çekemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme
      .from("tenant_modules")
      .select("id")
      .eq("tenant_id", SEED.beta.tenantId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("seed verisi: acme'de pos_cash açık, beta'da kapalı", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const beta = await signInAsSeededOwner(SEED.beta.ownerEmail);

    const acmeResult = await acme
      .from("tenant_modules")
      .select("is_enabled")
      .eq("module_key", "pos_cash")
      .maybeSingle();
    const betaResult = await beta
      .from("tenant_modules")
      .select("is_enabled")
      .eq("module_key", "pos_cash")
      .maybeSingle();

    expect(acmeResult.data?.is_enabled).toBe(true);
    expect(betaResult.data?.is_enabled).toBe(false);
  });
});
