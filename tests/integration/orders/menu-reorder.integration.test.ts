import { afterAll, describe, expect, it } from "vitest";

import { SEED, bootstrapGuestForTable, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

// bootstrapGuestForTable table1Id üzerinde bir table_session açık bırakır;
// kapatılmazsa aynı koşumdaki başka dosyaların (örn. table-qr-redeem) "Cihaz
// 1/2" beklentisini bozar (aktif oturumu bulup üstüne 3. cihaz ekler).
let openedSessionId: string | null = null;

afterAll(async () => {
  const service = serviceRoleClient();

  if (openedSessionId) {
    await service
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", openedSessionId);
  }

  // Bu dosya acme'nin GERÇEK demo kataloğunu yeniden sıralıyor ve eskiden
  // sırayı ters bırakıyordu: `pnpm test:integration` koştuktan sonra demo
  // menüde "Tatlılar" içeceklerin önüne geçiyor, Latte de Filtre Kahve'nin
  // önüne. Yukarıdaki table_sessions temizliğiyle aynı gerekçe — paylaşılan
  // seed verisi test koşumundan etkilenmemeli — seed sırası geri yüklenir.
  await Promise.all([
    service.from("menu_categories").update({ display_order: 0 }).eq("id", ACME_CATEGORY_DRINKS),
    service.from("menu_categories").update({ display_order: 1 }).eq("id", ACME_CATEGORY_DESSERTS),
    service.from("products").update({ display_order: 0 }).eq("id", ACME_PRODUCT_COFFEE),
    service.from("products").update({ display_order: 1 }).eq("id", ACME_PRODUCT_LATTE),
    service.from("product_variants").update({ display_order: 0 }).eq("id", ACME_VARIANT_SMALL),
    service.from("product_variants").update({ display_order: 1 }).eq("id", ACME_VARIANT_LARGE),
    service.from("product_extras").update({ display_order: 0 }).eq("id", ACME_EXTRA_SAUCE1),
    service.from("product_extras").update({ display_order: 1 }).eq("id", ACME_EXTRA_SAUCE2),
  ]);
});

const ACME_CATEGORY_DRINKS = "00000000-0000-4000-8000-000000000101";
const ACME_CATEGORY_DESSERTS = "00000000-0000-4000-8000-000000000102";
const BETA_CATEGORY_MAINS = "00000000-0000-4000-8000-000000000103";
const ACME_PRODUCT_COFFEE = "00000000-0000-4000-8000-000000000201";
const ACME_PRODUCT_LATTE = "00000000-0000-4000-8000-000000000202";
const ACME_VARIANT_SMALL = "00000000-0000-4000-8000-000000000301";
const ACME_VARIANT_LARGE = "00000000-0000-4000-8000-000000000302";
const ACME_PRODUCT_CHEESECAKE = "00000000-0000-4000-8000-000000000203";
const ACME_EXTRA_SAUCE1 = "00000000-0000-4000-8000-000000000401";
const ACME_EXTRA_SAUCE2 = "00000000-0000-4000-8000-000000000402";

describe("RPC: menu reorder", () => {
  it("reorder_menu_categories staff için sıralamayı kalıcı olarak değiştirir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner.rpc("reorder_menu_categories", {
      p_ids: [ACME_CATEGORY_DESSERTS, ACME_CATEGORY_DRINKS],
    });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data } = await service
      .from("menu_categories")
      .select("id, display_order")
      .in("id", [ACME_CATEGORY_DRINKS, ACME_CATEGORY_DESSERTS]);

    expect(data?.find((r) => r.id === ACME_CATEGORY_DESSERTS)?.display_order).toBe(0);
    expect(data?.find((r) => r.id === ACME_CATEGORY_DRINKS)?.display_order).toBe(1);
  });

  it("reorder_menu_categories dizideki başka tenant'ın id'sini sessizce yok sayar", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner.rpc("reorder_menu_categories", {
      p_ids: [BETA_CATEGORY_MAINS, ACME_CATEGORY_DRINKS],
    });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data } = await service.from("menu_categories").select("display_order").eq("id", BETA_CATEGORY_MAINS).single();
    expect(data?.display_order).toBe(0); // beta'nın kendi sırası değişmedi
  });

  it("reorder_menu_categories misafir (staff olmayan) için reddedilir", async () => {
    const { client, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    openedSessionId = tableSessionId;
    const { error } = await client.rpc("reorder_menu_categories", { p_ids: [ACME_CATEGORY_DRINKS] });
    expect(error).not.toBeNull();
  });

  it("reorder_products yalnızca aynı kategori kapsamında sıralar", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner.rpc("reorder_products", {
      p_category_id: ACME_CATEGORY_DRINKS,
      p_ids: [ACME_PRODUCT_LATTE, ACME_PRODUCT_COFFEE],
    });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data } = await service
      .from("products")
      .select("id, display_order")
      .in("id", [ACME_PRODUCT_COFFEE, ACME_PRODUCT_LATTE]);

    expect(data?.find((r) => r.id === ACME_PRODUCT_LATTE)?.display_order).toBe(0);
    expect(data?.find((r) => r.id === ACME_PRODUCT_COFFEE)?.display_order).toBe(1);
  });

  it("reorder_product_variants sıralamayı değiştirir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner.rpc("reorder_product_variants", {
      p_product_id: ACME_PRODUCT_LATTE,
      p_ids: [ACME_VARIANT_LARGE, ACME_VARIANT_SMALL],
    });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data } = await service
      .from("product_variants")
      .select("id, display_order")
      .in("id", [ACME_VARIANT_SMALL, ACME_VARIANT_LARGE]);

    expect(data?.find((r) => r.id === ACME_VARIANT_LARGE)?.display_order).toBe(0);
    expect(data?.find((r) => r.id === ACME_VARIANT_SMALL)?.display_order).toBe(1);
  });

  it("reorder_product_extras sıralamayı değiştirir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner.rpc("reorder_product_extras", {
      p_product_id: ACME_PRODUCT_CHEESECAKE,
      p_ids: [ACME_EXTRA_SAUCE2, ACME_EXTRA_SAUCE1],
    });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data } = await service
      .from("product_extras")
      .select("id, display_order")
      .in("id", [ACME_EXTRA_SAUCE1, ACME_EXTRA_SAUCE2]);

    expect(data?.find((r) => r.id === ACME_EXTRA_SAUCE2)?.display_order).toBe(0);
    expect(data?.find((r) => r.id === ACME_EXTRA_SAUCE1)?.display_order).toBe(1);
  });
});
