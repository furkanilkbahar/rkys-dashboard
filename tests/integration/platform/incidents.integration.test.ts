import { afterAll, describe, expect, it } from "vitest";

import { anonClient, createPlatformAdmin, SEED, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const createdUserIds = new Set<string>();
const createdIncidentIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of createdUserIds) {
    await service.auth.admin.deleteUser(id);
  }
  for (const id of createdIncidentIds) {
    await service.from("incidents").delete().eq("id", id);
  }
});

describe("incidents/incident_updates RLS (Faz 4 Adım 7)", () => {
  it("herkes (anon dahil) incidents'ı okuyabilir, yazamaz", async () => {
    const admin = await createPlatformAdmin("incidents-read");
    createdUserIds.add(admin.userId);
    const { data: incident } = await admin.client.from("incidents").insert({ title: "Test kesintisi" }).select("id").single();
    createdIncidentIds.add(incident!.id);

    const anon = anonClient();
    const { data: seenByAnon, error: anonReadError } = await anon.from("incidents").select("id").eq("id", incident!.id);
    expect(anonReadError).toBeNull();
    expect(seenByAnon).toHaveLength(1);

    const { error: anonWriteError } = await anon.from("incidents").insert({ title: "sızma denemesi" });
    expect(anonWriteError).not.toBeNull();

    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: seenByOwner } = await owner.from("incidents").select("id").eq("id", incident!.id);
    expect(seenByOwner).toHaveLength(1);
    const { error: ownerWriteError } = await owner.from("incidents").insert({ title: "sızma denemesi 2" });
    expect(ownerWriteError).not.toBeNull();
  });

  it("yalnızca platform_admin incident oluşturup güncelleme ekleyebilir; durum akışı investigating→resolved", async () => {
    const admin = await createPlatformAdmin("incidents-flow");
    createdUserIds.add(admin.userId);

    const { data: incident, error: createError } = await admin.client
      .from("incidents")
      .insert({ title: "API yavaşlığı" })
      .select("id, status")
      .single();
    expect(createError).toBeNull();
    expect(incident?.status).toBe("investigating");
    createdIncidentIds.add(incident!.id);

    const { error: updateInsertError } = await admin.client
      .from("incident_updates")
      .insert({ incident_id: incident!.id, body: "Sorunu tespit ettik." });
    expect(updateInsertError).toBeNull();

    const { error: statusError } = await admin.client
      .from("incidents")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", incident!.id);
    expect(statusError).toBeNull();

    const service = serviceRoleClient();
    const { data: resolved } = await service.from("incidents").select("status, resolved_at").eq("id", incident!.id).single();
    expect(resolved?.status).toBe("resolved");
    expect(resolved?.resolved_at).not.toBeNull();

    const { data: updates } = await anonClient().from("incident_updates").select("body").eq("incident_id", incident!.id);
    expect(updates).toHaveLength(1);
  });
});
