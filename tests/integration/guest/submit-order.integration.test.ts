import { afterAll, describe, expect, it } from "vitest";

import { SEED, bootstrapGuestForTable, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const ACME_COFFEE_PRODUCT_ID = "00000000-0000-4000-8000-000000000201"; // takipsiz stok
const ACME_CHEESECAKE_PRODUCT_ID = "00000000-0000-4000-8000-000000000203"; // tükendi (seed)
const ACME_LATTE_PRODUCT_ID = "00000000-0000-4000-8000-000000000202";
const ACME_LATTE_SMALL_VARIANT_ID = "00000000-0000-4000-8000-000000000301";
const ACME_CHEESECAKE_EXTRA_ID = "00000000-0000-4000-8000-000000000401";

const openedSessionIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of openedSessionIds) {
    await service
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", id);
  }
});

async function guestOnTable1() {
  const { client, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
  openedSessionIds.add(tableSessionId);
  return { client, tableSessionId };
}

describe("submit_order RPC", () => {
  it("basit üründen (varyantsız) sipariş oluşturur, subtotal doğru hesaplanır", async () => {
    const { client } = await guestOnTable1();

    const { data, error } = await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity: 2, extraIds: [] }],
    });

    expect(error).toBeNull();
    expect(data?.[0].order_status).toBe("approved"); // acme tenant_settings.order_mode = direct (varsayılan)
    expect(data?.[0].subtotal_minor).toBe(16000); // 8000 * 2
  });

  it("aynı idempotency_key iki kez gönderilirse tek sipariş kaydı oluşur", async () => {
    const { client, tableSessionId } = await guestOnTable1();
    const key = crypto.randomUUID();

    const first = await client.rpc("submit_order", {
      p_idempotency_key: key,
      p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity: 1, extraIds: [] }],
    });
    const second = await client.rpc("submit_order", {
      p_idempotency_key: key,
      p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity: 1, extraIds: [] }],
    });

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(second.data?.[0].order_id).toBe(first.data?.[0].order_id);

    const { count } = await serviceRoleClient()
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("table_session_id", tableSessionId)
      .eq("idempotency_key", key);
    expect(count).toBe(1);
  });

  it("tükenmiş ürün siparişi reddedilir", async () => {
    const { client } = await guestOnTable1();

    const { error } = await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId: ACME_CHEESECAKE_PRODUCT_ID, variantId: null, quantity: 1, extraIds: [] }],
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("STOCK_UNAVAILABLE");
  });

  it("stoktan fazla miktar istenirse reddedilir ve stok değişmez", async () => {
    const service = serviceRoleClient();
    await service.from("products").update({ stock_quantity: 3 }).eq("id", ACME_COFFEE_PRODUCT_ID);

    const { client } = await guestOnTable1();
    const { error } = await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity: 5, extraIds: [] }],
    });

    expect(error).not.toBeNull();

    const { data: product } = await service
      .from("products")
      .select("stock_quantity")
      .eq("id", ACME_COFFEE_PRODUCT_ID)
      .single();
    expect(product?.stock_quantity).toBe(3); // reddedilen sipariş stok düşürmemeli

    await service.from("products").update({ stock_quantity: null }).eq("id", ACME_COFFEE_PRODUCT_ID);
  });

  it("başarılı sipariş takip edilen stoğu düşürür", async () => {
    const service = serviceRoleClient();
    await service.from("products").update({ stock_quantity: 5 }).eq("id", ACME_COFFEE_PRODUCT_ID);

    const { client } = await guestOnTable1();
    const { error } = await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity: 2, extraIds: [] }],
    });
    expect(error).toBeNull();

    const { data: product } = await service
      .from("products")
      .select("stock_quantity")
      .eq("id", ACME_COFFEE_PRODUCT_ID)
      .single();
    expect(product?.stock_quantity).toBe(3);

    await service.from("products").update({ stock_quantity: null }).eq("id", ACME_COFFEE_PRODUCT_ID);
  });

  it("varyantlı sipariş oluşturur; order_items isim kopyası içerir", async () => {
    const { client } = await guestOnTable1();

    const { data, error } = await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [
        {
          productId: ACME_LATTE_PRODUCT_ID,
          variantId: ACME_LATTE_SMALL_VARIANT_ID,
          quantity: 1,
          extraIds: [],
        },
      ],
    });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: items } = await service
      .from("order_items")
      .select("product_name_snapshot, variant_name_snapshot, unit_price_minor")
      .eq("order_id", data![0].order_id);

    expect(items?.[0].product_name_snapshot).toBe("Latte");
    expect(items?.[0].variant_name_snapshot).toBe("Küçük");
    expect(items?.[0].unit_price_minor).toBe(9000);
  });

  it("ekstralı sipariş oluşturur; order_item_extras isim kopyası ve fiyatı içerir", async () => {
    const service = serviceRoleClient();
    // Cheesecake seed'de tükendi (is_sold_out=true, stock_quantity=0) —
    // bu test için geçici olarak stokta gösterilir.
    await service
      .from("products")
      .update({ is_sold_out: false, stock_quantity: 5 })
      .eq("id", ACME_CHEESECAKE_PRODUCT_ID);

    const { client } = await guestOnTable1();
    const { data, error } = await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [
        {
          productId: ACME_CHEESECAKE_PRODUCT_ID,
          variantId: null,
          quantity: 1,
          extraIds: [ACME_CHEESECAKE_EXTRA_ID],
        },
      ],
    });
    expect(error).toBeNull();

    const { data: orderItem } = await service
      .from("order_items")
      .select("id")
      .eq("order_id", data![0].order_id)
      .single();
    const { data: extras } = await service
      .from("order_item_extras")
      .select("extra_name_snapshot, unit_price_minor")
      .eq("order_item_id", orderItem!.id);

    expect(extras?.[0].extra_name_snapshot).toBe("Çilek Sosu");
    expect(extras?.[0].unit_price_minor).toBe(1500);
    expect(data?.[0].subtotal_minor).toBe(12000 + 1500);

    await service
      .from("products")
      .update({ is_sold_out: true, stock_quantity: 0 })
      .eq("id", ACME_CHEESECAKE_PRODUCT_ID);
  });

  it("kapalı masa oturumunda sipariş reddedilir", async () => {
    const { client, tableSessionId } = await guestOnTable1();
    await serviceRoleClient()
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", tableSessionId);

    const { error } = await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity: 1, extraIds: [] }],
    });

    expect(error).not.toBeNull();
  });

  it("personel (guest olmayan) submit_order çağıramaz", async () => {
    const acmeOwner = await signInAsSeededOwner(SEED.acme.ownerEmail);

    const { error } = await acmeOwner.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity: 1, extraIds: [] }],
    });

    expect(error).not.toBeNull();
  });
});
