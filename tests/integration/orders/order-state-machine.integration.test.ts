import { afterAll, describe, expect, it } from "vitest";

import { SEED, bootstrapGuestForTable, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const ACME_COFFEE_PRODUCT_ID = "00000000-0000-4000-8000-000000000201";

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

async function placeApprovedOrder() {
  // Her çağrı taze bir table_session ile başlar — submit_order'ın RULES #8
  // hız sınırı (aynı oturumdan 60sn'de 5 sipariş) bu dosyadaki art arda
  // çağrılarda paylaşılan bir oturumda gerçek olmayan şekilde tetiklenmesin.
  const service = serviceRoleClient();
  await service
    .from("table_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("table_id", SEED.acme.table1Id)
    .eq("status", "active");

  const { client, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
  openedSessionIds.add(tableSessionId);

  const { data, error } = await client.rpc("submit_order", {
    p_idempotency_key: crypto.randomUUID(),
    p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity: 1, extraIds: [] }],
  });
  if (error || !data) {
    throw new Error(`submit_order failed: ${error?.message}`);
  }
  return { orderId: data[0].order_id as string, guestClient: client };
}

describe("advance_order_status (RULES #24)", () => {
  it("approved -> preparing -> ready -> served sırasıyla geçer", async () => {
    const { orderId } = await placeApprovedOrder();
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);

    for (const next of ["preparing", "ready", "served"]) {
      const { error } = await owner.rpc("advance_order_status", { p_order_id: orderId, p_to_status: next });
      expect(error).toBeNull();
    }

    const { data: order } = await serviceRoleClient().from("orders").select("status").eq("id", orderId).single();
    expect(order?.status).toBe("served");
  });

  it("approved -> served atlaması reddedilir", async () => {
    const { orderId } = await placeApprovedOrder();
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);

    const { error } = await owner.rpc("advance_order_status", { p_order_id: orderId, p_to_status: "served" });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("ILLEGAL_TRANSITION");
  });

  it("misafir advance_order_status çağıramaz", async () => {
    const { orderId, guestClient } = await placeApprovedOrder();

    const { error } = await guestClient.rpc("advance_order_status", { p_order_id: orderId, p_to_status: "preparing" });
    expect(error).not.toBeNull();
  });
});

describe("D22 karma iptal", () => {
  it("misafir approved siparişi doğrudan iptal edebilir", async () => {
    const { orderId, guestClient } = await placeApprovedOrder();

    const { error } = await guestClient.rpc("cancel_order", { p_order_id: orderId });
    expect(error).toBeNull();

    const { data: order } = await serviceRoleClient().from("orders").select("status").eq("id", orderId).single();
    expect(order?.status).toBe("cancelled");
  });

  it("misafir preparing siparişi doğrudan iptal edemez", async () => {
    const { orderId, guestClient } = await placeApprovedOrder();
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    await owner.rpc("advance_order_status", { p_order_id: orderId, p_to_status: "preparing" });

    const { error } = await guestClient.rpc("cancel_order", { p_order_id: orderId });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("ORDER_NOT_CANCELLABLE");
  });

  it("preparing siparişte misafir iptal isteği açabilir, personel onaylayınca iptal olur", async () => {
    const { orderId, guestClient } = await placeApprovedOrder();
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    await owner.rpc("advance_order_status", { p_order_id: orderId, p_to_status: "preparing" });

    const { error: reqError } = await guestClient.rpc("request_order_cancellation", {
      p_order_id: orderId,
      p_reason: "yanlış sipariş verdim",
    });
    expect(reqError).toBeNull();

    const { error: approveError } = await owner.rpc("approve_cancellation_request", { p_order_id: orderId });
    expect(approveError).toBeNull();

    const { data: order } = await serviceRoleClient().from("orders").select("status").eq("id", orderId).single();
    expect(order?.status).toBe("cancelled");
  });

  it("personel iptal isteğini reddedebilir; sipariş preparing'te kalır", async () => {
    const { orderId, guestClient } = await placeApprovedOrder();
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    await owner.rpc("advance_order_status", { p_order_id: orderId, p_to_status: "preparing" });
    await guestClient.rpc("request_order_cancellation", { p_order_id: orderId, p_reason: "test" });

    const { error } = await owner.rpc("reject_cancellation_request", { p_order_id: orderId });
    expect(error).toBeNull();

    const { data: order } = await serviceRoleClient()
      .from("orders")
      .select("status, cancel_requested_at")
      .eq("id", orderId)
      .single();
    expect(order?.status).toBe("preparing");
    expect(order?.cancel_requested_at).toBeNull();
  });
});
