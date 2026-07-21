import { afterAll, describe, expect, it } from "vitest";

import { SEED, bootstrapGuestForTable, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

let openedSessionId: string | null = null;

afterAll(async () => {
  if (openedSessionId) {
    await serviceRoleClient()
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", openedSessionId);
  }
});

describe("RLS: table_zones", () => {
  it("acme owner kendi tenant'ının bölgelerini görür, beta'nınkileri göremez", async () => {
    const service = serviceRoleClient();
    await service.from("table_zones").insert([
      { tenant_id: SEED.acme.tenantId, branch_id: SEED.acme.branchId, name: "Salon" },
      { tenant_id: SEED.beta.tenantId, branch_id: SEED.beta.branchId, name: "Teras" },
    ]);

    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("table_zones").select("tenant_id");

    expect(error).toBeNull();
    expect(data?.every((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);
    expect(data?.length).toBeGreaterThan(0);
  });

  it("acme owner, beta'nın tenant_id'siyle bölge INSERT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await acme
      .from("table_zones")
      .insert({ tenant_id: SEED.beta.tenantId, branch_id: SEED.beta.branchId, name: "Yetkisiz" });

    expect(error).not.toBeNull();
  });

  it("misafir (staff olmayan) bölge yazamaz", async () => {
    const { client, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    openedSessionId = tableSessionId;
    const { error } = await client
      .from("table_zones")
      .insert({ tenant_id: SEED.acme.tenantId, branch_id: SEED.acme.branchId, name: "Misafir Bölgesi" });

    expect(error).not.toBeNull();
  });
});
