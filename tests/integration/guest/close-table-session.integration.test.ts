import { describe, expect, it } from "vitest";

import { SEED, bootstrapGuestForTable, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

describe("close_table_session", () => {
  it("misafir oturumu kendisi kapatamaz", async () => {
    const { client, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);

    const { error } = await client.rpc("close_table_session", {
      p_table_session_id: tableSessionId,
      p_reason: "manual",
    });
    expect(error).not.toBeNull();

    await serviceRoleClient()
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", tableSessionId);
  });

  it("personel oturumu manuel kapatabilir; audit kaydı düşer", async () => {
    const { tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);

    const { error } = await owner.rpc("close_table_session", {
      p_table_session_id: tableSessionId,
      p_reason: "manual",
    });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: session } = await service
      .from("table_sessions")
      .select("status, close_reason")
      .eq("id", tableSessionId)
      .single();
    expect(session?.status).toBe("closed");
    expect(session?.close_reason).toBe("manual");

    const { data: events } = await service
      .from("session_events")
      .select("event_type")
      .eq("table_session_id", tableSessionId)
      .eq("event_type", "closed");
    expect(events).toHaveLength(1);
  });

  it("'payment' sebebiyle kapatma Faz 1'de reddedilir (Faz 3'e kadar şema-only)", async () => {
    const { tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);

    const { error } = await owner.rpc("close_table_session", {
      p_table_session_id: tableSessionId,
      p_reason: "payment",
    });
    expect(error).not.toBeNull();

    await serviceRoleClient()
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", tableSessionId);
  });
});

describe("close_stale_table_sessions", () => {
  it("son aktivitesi zaman aşımını aşan aktif oturumları kapatır", async () => {
    const { tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    const service = serviceRoleClient();

    // Zaman aşımını simüle etmek için last_activity_at geçmişe çekilir.
    await service
      .from("table_sessions")
      .update({ last_activity_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() })
      .eq("id", tableSessionId);

    const { error } = await service.rpc("close_stale_table_sessions");
    expect(error).toBeNull();

    const { data: session } = await service
      .from("table_sessions")
      .select("status, close_reason")
      .eq("id", tableSessionId)
      .single();
    expect(session?.status).toBe("closed");
    expect(session?.close_reason).toBe("timeout");
  });
});
