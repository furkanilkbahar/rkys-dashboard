import { afterAll, describe, expect, it } from "vitest";

import { SEED, bootstrapGuestForTable, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const ACME_COFFEE_PRODUCT_ID = "00000000-0000-4000-8000-000000000201"; // 8000 kuruş

const openedSessionIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of openedSessionIds) {
    await service.from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id);
  }
});

describe("RPC: online ödeme (create_pending_online_payment / complete_online_payment)", () => {
  it("misafir kendi oturumu için bekleyen ödeme oluşturur", async () => {
    const { client, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    openedSessionIds.add(tableSessionId);

    await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity: 1, extraIds: [] }],
    });

    const providerRef = crypto.randomUUID();
    const { data: paymentId, error } = await client.rpc("create_pending_online_payment", {
      p_table_session_id: tableSessionId,
      p_amount_minor: 8000,
      p_tip_amount_minor: 0,
      p_provider: "mock",
      p_provider_ref: providerRef,
    });
    expect(error).toBeNull();
    expect(paymentId).toBeTruthy();

    const service = serviceRoleClient();
    const { data: payment } = await service.from("payments").select("status, method").eq("id", paymentId!).single();
    expect(payment?.status).toBe("pending");
    expect(payment?.method).toBe("online");
  });

  it("misafir başka bir oturum için bekleyen ödeme oluşturamaz", async () => {
    const { client: clientA, tableSessionId: sessionA } = await bootstrapGuestForTable(SEED.acme.table2Id);
    openedSessionIds.add(sessionA);
    const { tableSessionId: sessionB } = await bootstrapGuestForTable(SEED.acme.table1Id);
    openedSessionIds.add(sessionB);

    const { error } = await clientA.rpc("create_pending_online_payment", {
      p_table_session_id: sessionB,
      p_amount_minor: 1000,
      p_tip_amount_minor: 0,
      p_provider: "mock",
      p_provider_ref: crypto.randomUUID(),
    });
    expect(error).not.toBeNull();
  });

  it("complete_online_payment: ödeme tamamlanır, oturum kapanır, tekrar çağrı idempotent no-op'tur", async () => {
    const { client, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table2Id);
    openedSessionIds.add(tableSessionId);

    await client.rpc("submit_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity: 1, extraIds: [] }],
    });

    const providerRef = crypto.randomUUID();
    await client.rpc("create_pending_online_payment", {
      p_table_session_id: tableSessionId,
      p_amount_minor: 8000,
      p_tip_amount_minor: 0,
      p_provider: "mock",
      p_provider_ref: providerRef,
    });

    const service = serviceRoleClient();
    const { error: firstComplete } = await service.rpc("complete_online_payment", {
      p_provider: "mock",
      p_provider_ref: providerRef,
    });
    expect(firstComplete).toBeNull();

    const { data: session } = await service.from("table_sessions").select("status, close_reason").eq("id", tableSessionId).single();
    expect(session?.status).toBe("closed");
    expect(session?.close_reason).toBe("payment");

    // İkinci kez aynı webhook (retry/duplicate delivery) hata vermemeli.
    const { error: secondComplete } = await service.rpc("complete_online_payment", {
      p_provider: "mock",
      p_provider_ref: providerRef,
    });
    expect(secondComplete).toBeNull();
  });

  it("complete_online_payment: bilinmeyen provider_ref reddedilir", async () => {
    const service = serviceRoleClient();
    const { error } = await service.rpc("complete_online_payment", {
      p_provider: "mock",
      p_provider_ref: crypto.randomUUID(),
    });
    expect(error).not.toBeNull();
  });

  it("RLS: payments yalnızca kendi tenant'ının personeline görünür", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await owner.from("payments").select("tenant_id");
    expect(error).toBeNull();
    expect(data?.every((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);
  });
});
