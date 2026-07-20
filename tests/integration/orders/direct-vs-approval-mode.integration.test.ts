import { afterAll, describe, expect, it } from "vitest";

import { SEED, bootstrapGuestForTable, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const ACME_COFFEE_PRODUCT_ID = "00000000-0000-4000-8000-000000000201";
const openedSessionIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  await service.from("tenant_settings").update({ order_mode: "direct" }).eq("tenant_id", SEED.acme.tenantId);
  for (const id of openedSessionIds) {
    await service
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", id);
  }
});

// S2: onay modlu tenant'ta sipariş garson onayına düşer; onaysız mutfağa gitmez.
describe("D10 sipariş modu: direct vs approval", () => {
  it("approval modunda sipariş 'pending' başlar, garson onaylamadan preparing'e geçemez", async () => {
    await serviceRoleClient()
      .from("tenant_settings")
      .update({ order_mode: "approval" })
      .eq("tenant_id", SEED.acme.tenantId);

    const { client, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    openedSessionIds.add(tableSessionId);

    const { data } = await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity: 1, extraIds: [] }],
    });
    expect(data?.[0].order_status).toBe("pending");
    const orderId = data![0].order_id as string;

    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error: skipApprovalError } = await owner.rpc("advance_order_status", {
      p_order_id: orderId,
      p_to_status: "preparing",
    });
    expect(skipApprovalError).not.toBeNull(); // pending'den doğrudan preparing'e geçiş yasak

    const { error: approveError } = await owner.rpc("approve_order", { p_order_id: orderId });
    expect(approveError).toBeNull();

    const { error: advanceError } = await owner.rpc("advance_order_status", {
      p_order_id: orderId,
      p_to_status: "preparing",
    });
    expect(advanceError).toBeNull();
  });

  it("direct modunda sipariş doğrudan 'approved' başlar", async () => {
    await serviceRoleClient()
      .from("tenant_settings")
      .update({ order_mode: "direct" })
      .eq("tenant_id", SEED.acme.tenantId);

    const { client, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    openedSessionIds.add(tableSessionId);

    const { data } = await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity: 1, extraIds: [] }],
    });
    expect(data?.[0].order_status).toBe("approved");
  });
});
