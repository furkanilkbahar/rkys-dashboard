import { afterEach, describe, expect, it } from "vitest";

import { SEED, bootstrapGuestForTable, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

// RULES #27: masa taşıma müşteri arayüzünde asla sunulmaz — misafir RPC'yi
// hiçbir koşulda çağıramaz. RULES #41: session.move izni RPC içinde ayrıca
// doğrulanır (owner bypass + role_permissions), yalnız is_staff() yetmez.
async function closeAllActiveSessionsForTable(tableId: string) {
  await serviceRoleClient()
    .from("table_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("table_id", tableId)
    .eq("status", "active");
}

afterEach(async () => {
  await closeAllActiveSessionsForTable(SEED.acme.table1Id);
  await closeAllActiveSessionsForTable(SEED.acme.table2Id);
});

describe("move_table_session", () => {
  it("misafir masa taşıma RPC'sini hiçbir koşulda çağıramaz", async () => {
    const { client, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);

    const { error } = await client.rpc("move_table_session", {
      p_table_session_id: tableSessionId,
      p_to_table_id: SEED.acme.table2Id,
      p_reason: undefined,
    });

    expect(error).not.toBeNull();
  });

  it("session.move izni olmayan personel (waiter) reddedilir", async () => {
    const { tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    const waiter = await signInAsSeededOwner(SEED.acme.waiterEmail);

    const { error } = await waiter.rpc("move_table_session", {
      p_table_session_id: tableSessionId,
      p_to_table_id: SEED.acme.table2Id,
      p_reason: undefined,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("PERMISSION_DENIED");
  });

  it("session.move izni olan personel (manager) masayı taşıyabilir ve audit kaydı düşer", async () => {
    const { tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    const manager = await signInAsSeededOwner(SEED.acme.managerEmail);

    const { error } = await manager.rpc("move_table_session", {
      p_table_session_id: tableSessionId,
      p_to_table_id: SEED.acme.table2Id,
      p_reason: "müşteri talebi",
    });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: session } = await service
      .from("table_sessions")
      .select("table_id")
      .eq("id", tableSessionId)
      .single();
    expect(session?.table_id).toBe(SEED.acme.table2Id);

    const { data: events } = await service
      .from("session_events")
      .select("event_type, from_table_id, to_table_id")
      .eq("table_session_id", tableSessionId)
      .eq("event_type", "table_moved");
    expect(events).toHaveLength(1);
    expect(events?.[0].from_table_id).toBe(SEED.acme.table1Id);
    expect(events?.[0].to_table_id).toBe(SEED.acme.table2Id);
  });

  it("owner her zaman masayı taşıyabilir (izin bayrağına bakılmaksızın)", async () => {
    const { tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);

    const { error } = await owner.rpc("move_table_session", {
      p_table_session_id: tableSessionId,
      p_to_table_id: SEED.acme.table2Id,
      p_reason: undefined,
    });
    expect(error).toBeNull();
  });
});
