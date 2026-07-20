import { afterAll, describe, expect, it } from "vitest";

import { SEED, bootstrapGuestForTable, serviceRoleClient } from "../../helpers/testClients";

// Regresyon testi: 0007'nin is_staff() sertleşmesi misafirin branches'ı hiç
// okuyamamasına yol açmıştı, bu da effective_menu_items view'ının (inner
// join branches) misafir için sıfır satır döndürüp her ürünü yanlışlıkla
// "tükendi" göstermesine sebep oldu (0014 ile düzeltildi).
const ACME_COFFEE_PRODUCT_ID = "00000000-0000-4000-8000-000000000201"; // stokta
const ACME_CHEESECAKE_PRODUCT_ID = "00000000-0000-4000-8000-000000000203"; // tükendi (seed)

let openedSessionId: string | null = null;

afterAll(async () => {
  if (openedSessionId) {
    await serviceRoleClient()
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", openedSessionId);
  }
});

describe("Misafir: effective_menu_items okuyabilir ve doğru stok durumunu görür", () => {
  it("misafir kendi şubesinin etkin menüsünü okuyabilir", async () => {
    const { client, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    openedSessionId = tableSessionId;

    const { data, error } = await client
      .from("effective_menu_items")
      .select("product_id, is_orderable")
      .eq("branch_id", SEED.acme.branchId);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it("stoktaki ürün is_orderable=true, tükenen ürün is_orderable=false döner", async () => {
    const { client } = await bootstrapGuestForTable(SEED.acme.table1Id);

    const { data: coffee } = await client
      .from("effective_menu_items")
      .select("is_orderable")
      .eq("branch_id", SEED.acme.branchId)
      .eq("product_id", ACME_COFFEE_PRODUCT_ID)
      .is("variant_id", null)
      .maybeSingle();
    const { data: cheesecake } = await client
      .from("effective_menu_items")
      .select("is_orderable")
      .eq("branch_id", SEED.acme.branchId)
      .eq("product_id", ACME_CHEESECAKE_PRODUCT_ID)
      .is("variant_id", null)
      .maybeSingle();

    expect(coffee?.is_orderable).toBe(true);
    expect(cheesecake?.is_orderable).toBe(false);
  });

  it("misafir yalnızca kendi şubesini görür, başka tenant'ın şubesini göremez", async () => {
    const { client } = await bootstrapGuestForTable(SEED.acme.table1Id);

    const { data, error } = await client.from("branches").select("id").eq("id", SEED.beta.branchId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
