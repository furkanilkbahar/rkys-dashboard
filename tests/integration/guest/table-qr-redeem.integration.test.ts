import { afterAll, describe, expect, it } from "vitest";

import { SEED, bootstrapGuestForTable, serviceRoleClient } from "../../helpers/testClients";

// Bu dosyanın kendi bootstrap çağrıları table_sessions'ta yeni bir aktif
// oturum açar; testler tekrar tekrar (db reset olmadan) çalıştırılabilsin
// diye sonda oturum kapatılır (yeni koşum yeni bir oturumla başlasın).
let openedSessionId: string | null = null;

afterAll(async () => {
  if (openedSessionId) {
    await serviceRoleClient()
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", openedSessionId);
  }
});

describe("Misafir: masa QR bootstrap", () => {
  it("geçersiz qr_token_hash için masa bulunamaz", async () => {
    const { data, error } = await serviceRoleClient()
      .from("tables")
      .select("id")
      .eq("qr_token_hash", "0".repeat(64))
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("pasif masa için lookup boş döner", async () => {
    const service = serviceRoleClient();
    await service.from("tables").update({ is_active: false }).eq("id", SEED.beta.table1Id);

    const { data } = await service
      .from("tables")
      .select("id")
      .eq("id", SEED.beta.table1Id)
      .eq("is_active", true)
      .maybeSingle();

    expect(data).toBeNull();

    await service.from("tables").update({ is_active: true }).eq("id", SEED.beta.table1Id);
  });

  it("geçerli masada ilk misafir oturum açar, ikincisi aynı oturumu bulur ve 'Cihaz 2' olur", async () => {
    const first = await bootstrapGuestForTable(SEED.acme.table1Id);
    openedSessionId = first.tableSessionId;

    const second = await bootstrapGuestForTable(SEED.acme.table1Id);
    expect(second.tableSessionId).toBe(first.tableSessionId);

    const { data: devices } = await serviceRoleClient()
      .from("table_session_devices")
      .select("device_label")
      .eq("table_session_id", first.tableSessionId)
      .order("created_at");

    expect(devices?.map((d) => d.device_label)).toEqual(["Cihaz 1", "Cihaz 2"]);
  });

  it("bootstrap sonrası misafir JWT'sinde doğru tenant/branch/table_session claim'leri olur", async () => {
    const { client, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    const { data } = await client.auth.getClaims();
    const claims = data?.claims as Record<string, unknown>;

    expect(claims.user_role).toBe("guest");
    expect(claims.tenant_id).toBe(SEED.acme.tenantId);
    expect(claims.branch_id).toBe(SEED.acme.branchId);
    expect(claims.table_session_id).toBe(tableSessionId);
  });
});
