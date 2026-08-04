import { afterAll, describe, expect, it } from "vitest";

import { SEED, bootstrapGuestForTable, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

let openedSessionId: string | null = null;
const insertedZoneIds: string[] = [];

afterAll(async () => {
  const service = serviceRoleClient();

  if (openedSessionId) {
    await service
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", openedSessionId);
  }

  // Bu test acme'nin GERÇEK bölge listesine "Salon" ekliyor ve eskiden hiç
  // temizlemiyordu: her koşumda bir mükerrer "Salon" daha birikiyordu
  // (2026-08-04'te yerelde 2 tane ölçüldü, panoda ve /admin/tables'ta
  // görünüyorlardı). Assertion'lar izolasyon tabanlı (`every`, `length > 0`),
  // sayıya bağlı değil — silmek hiçbir beklentiyi bozmaz.
  if (insertedZoneIds.length > 0) {
    await service.from("table_zones").delete().in("id", insertedZoneIds);
  }
});

describe("RLS: table_zones", () => {
  it("acme owner kendi tenant'ının bölgelerini görür, beta'nınkileri göremez", async () => {
    const service = serviceRoleClient();
    const { data: inserted } = await service
      .from("table_zones")
      .insert([
        { tenant_id: SEED.acme.tenantId, branch_id: SEED.acme.branchId, name: "Salon" },
        { tenant_id: SEED.beta.tenantId, branch_id: SEED.beta.branchId, name: "Teras" },
      ])
      .select("id");
    insertedZoneIds.push(...(inserted ?? []).map((row) => row.id));

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
