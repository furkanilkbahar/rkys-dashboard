import { afterAll, describe, expect, it } from "vitest";

import { SEED, bootstrapGuestForTable, serviceRoleClient } from "../../helpers/testClients";

// Bu dosyanın bootstrap çağrıları table_sessions'ta aktif bir oturum
// bırakır; testler db reset olmadan tekrar çalıştırılabilsin diye sonda
// kapatılır (bkz. table-qr-redeem.integration.test.ts'teki aynı desen).
let openedSessionId: string | null = null;

afterAll(async () => {
  if (openedSessionId) {
    await serviceRoleClient()
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", openedSessionId);
  }
});

describe("Misafir: RULES #5 — doğrudan tablo yazma/okuma reddi", () => {
  it("misafir 'tables' tablosunu doğrudan SELECT edemez (staff-only RLS)", async () => {
    const { client, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    openedSessionId = tableSessionId;
    const { data, error } = await client.from("tables").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("misafir kendi table_session'ını görebilir", async () => {
    const { client, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    const { data } = await client.from("table_sessions").select("id").eq("id", tableSessionId);

    expect(data).toHaveLength(1);
  });

  it("misafir table_sessions'a doğrudan INSERT edemez (grant yok — RPC-only)", async () => {
    const { client } = await bootstrapGuestForTable(SEED.acme.table1Id);
    const { error } = await client.from("table_sessions").insert({
      tenant_id: SEED.acme.tenantId,
      branch_id: SEED.acme.branchId,
      table_id: SEED.acme.table1Id,
    });

    expect(error).not.toBeNull();
  });

  it("misafir session_events'i doğrudan SELECT edemez (personel-only audit)", async () => {
    const { client } = await bootstrapGuestForTable(SEED.acme.table1Id);
    const { data, error } = await client.from("session_events").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("misafir table_session_devices'a doğrudan INSERT edemez (grant yok — RPC-only)", async () => {
    const { client, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    const { error } = await client.from("table_session_devices").insert({
      tenant_id: SEED.acme.tenantId,
      branch_id: SEED.acme.branchId,
      table_session_id: tableSessionId,
      guest_user_id: "00000000-0000-4000-8000-000000000000",
      device_label: "sızma denemesi",
    });

    expect(error).not.toBeNull();
  });
});
