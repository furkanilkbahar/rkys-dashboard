import { afterAll, describe, expect, it } from "vitest";

import { SEED, bootstrapGuestForTable, serviceRoleClient } from "../../helpers/testClients";

// Regresyon testi: table_session_devices'ın ilk SELECT politikası misafiri
// yalnızca kendi cihaz satırıyla sınırlıyordu; D24 "cihaz bazlı etiket"
// aynı masadaki TÜM cihazların görülebilir olmasını gerektirir (0022 ile
// düzeltildi — session-panel.tsx'in device_label "?" göstermesine sebep olan bug).
let openedSessionId: string | null = null;

afterAll(async () => {
  if (openedSessionId) {
    await serviceRoleClient()
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", openedSessionId);
  }
});

describe("table_session_devices: aynı masadaki paylaşımlı görünürlük", () => {
  it("bir misafir aynı table_session'daki DİĞER cihazın etiketini de görebilir", async () => {
    const first = await bootstrapGuestForTable(SEED.acme.table1Id);
    openedSessionId = first.tableSessionId;
    await bootstrapGuestForTable(SEED.acme.table1Id); // ikinci cihazı oluşturur

    const { data, error } = await first.client
      .from("table_session_devices")
      .select("device_label")
      .eq("table_session_id", first.tableSessionId)
      .order("created_at");

    expect(error).toBeNull();
    expect(data?.map((d) => d.device_label)).toEqual(["Cihaz 1", "Cihaz 2"]);
  });

  it("misafir başka bir table_session'ın cihazlarını göremez", async () => {
    const guest = await bootstrapGuestForTable(SEED.acme.table1Id);

    const { data, error } = await guest.client
      .from("table_session_devices")
      .select("id")
      .neq("table_session_id", guest.tableSessionId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
