import { afterAll, describe, expect, it } from "vitest";

import { createPlatformAdmin, SEED, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const createdUserIds = new Set<string>();
const createdRequestIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of createdRequestIds) {
    await service.from("module_requests").delete().eq("id", id);
  }
  for (const id of createdUserIds) {
    await service.auth.admin.deleteUser(id);
  }
});

describe("RLS: module_requests (Faz 4 revizyonu Adım 0)", () => {
  it("owner kendi tenant'ı için talep oluşturabilir, yalnızca kendi talebini görür", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: inserted, error: insertError } = await acme
      .from("module_requests")
      .insert({ tenant_id: SEED.acme.tenantId, module_key: "gift_cards" })
      .select()
      .single();
    expect(insertError).toBeNull();
    createdRequestIds.add(inserted!.id);

    const beta = await signInAsSeededOwner(SEED.beta.ownerEmail);
    const { data: betaView, error: betaError } = await beta
      .from("module_requests")
      .select("id")
      .eq("id", inserted!.id);
    expect(betaError).toBeNull();
    expect(betaView).toHaveLength(0);

    const { data: acmeView } = await acme.from("module_requests").select("id").eq("id", inserted!.id);
    expect(acmeView).toHaveLength(1);
  });

  it("owner başka tenant adına talep oluşturamaz", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error, data } = await acme
      .from("module_requests")
      .insert({ tenant_id: SEED.beta.tenantId, module_key: "kiosk" })
      .select();

    expect(error).not.toBeNull();
    expect(data).toBeFalsy();
  });

  it("platform_admin tüm tenant'ların taleplerini görebilir", async () => {
    const admin = await createPlatformAdmin("module-requests");
    createdUserIds.add(admin.userId);

    const { data, error } = await admin.client.from("module_requests").select("id, tenant_id");
    expect(error).toBeNull();
    expect(data!.some((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);
  });
});
