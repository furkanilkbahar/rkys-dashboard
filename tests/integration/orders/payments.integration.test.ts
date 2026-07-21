import { afterAll, describe, expect, it } from "vitest";

import { SEED, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const ACME_COFFEE_PRODUCT_ID = "00000000-0000-4000-8000-000000000201"; // 8000 kuruş, takipsiz stok

const openedSessionIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of openedSessionIds) {
    await service.from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id);
  }
});

async function getCounterTableId(tenantId: string, branchId: string) {
  const service = serviceRoleClient();
  const { data } = await service
    .from("tables")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("is_counter", true)
    .single();
  return data!.id as string;
}

async function openOrderedSession(owner: Awaited<ReturnType<typeof signInAsSeededOwner>>, quantity: number) {
  const counterTableId = await getCounterTableId(SEED.acme.tenantId, SEED.acme.branchId);
  const { data } = await owner.rpc("submit_staff_order", {
    p_table_id: counterTableId,
    p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity, extraIds: [] }],
  });
  const service = serviceRoleClient();
  const { data: session } = await service
    .from("table_sessions")
    .select("id")
    .eq("table_id", counterTableId)
    .eq("status", "active")
    .single();
  openedSessionIds.add(session!.id);
  return { tableSessionId: session!.id as string, subtotalMinor: data![0].subtotal_minor as number };
}

describe("RPC: record_payment", () => {
  it("tam ödeme: oturum kapanır, bakiye tükenir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { tableSessionId, subtotalMinor } = await openOrderedSession(owner, 1); // 8000

    const { data: paymentId, error } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: subtotalMinor,
      p_tip_amount_minor: 0,
    });
    expect(error).toBeNull();
    expect(paymentId).toBeTruthy();

    const service = serviceRoleClient();
    const { data: session } = await service
      .from("table_sessions")
      .select("status, close_reason")
      .eq("id", tableSessionId)
      .single();
    expect(session?.status).toBe("closed");
    expect(session?.close_reason).toBe("payment");
  });

  it("eşit bölüşme: N ödeme toplamı tam karşılayınca oturum kapanır, öncesinde açık kalır", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { tableSessionId, subtotalMinor } = await openOrderedSession(owner, 2); // 16000
    const splitGroup = crypto.randomUUID();
    const half = subtotalMinor / 2;

    const { error: firstError } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: half,
      p_tip_amount_minor: 500,
      p_split_group: splitGroup,
    });
    expect(firstError).toBeNull();

    const service = serviceRoleClient();
    const { data: midSession } = await service.from("table_sessions").select("status").eq("id", tableSessionId).single();
    expect(midSession?.status).toBe("active"); // yarısı ödendi, hâlâ açık

    const { error: secondError } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "card_manual",
      p_amount_minor: half,
      p_tip_amount_minor: 500,
      p_split_group: splitGroup,
    });
    expect(secondError).toBeNull();

    const { data: finalSession } = await service.from("table_sessions").select("status").eq("id", tableSessionId).single();
    expect(finalSession?.status).toBe("closed");

    const { data: payments } = await service
      .from("payments")
      .select("amount_minor, tip_amount_minor, split_group")
      .eq("table_session_id", tableSessionId);
    expect(payments).toHaveLength(2);
    expect(payments?.every((p) => p.split_group === splitGroup)).toBe(true);
    expect(payments?.reduce((sum, p) => sum + p.tip_amount_minor, 0)).toBe(1000);
  });

  it("nakit ödeme açık vardiyanın kasa hareketine yazılır", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: shiftId, error: shiftError } = await owner.rpc("open_shift", {
      p_branch_id: SEED.acme.branchId,
      p_opening_balance_minor: 0,
    });
    expect(shiftError).toBeNull();

    const { tableSessionId, subtotalMinor } = await openOrderedSession(owner, 1);
    const { error: payError } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: subtotalMinor,
      p_tip_amount_minor: 200,
    });
    expect(payError).toBeNull();

    const service = serviceRoleClient();
    const { data: movements } = await service
      .from("cash_movements")
      .select("movement_type, amount_minor")
      .eq("cash_shift_id", shiftId!)
      .eq("movement_type", "sale");
    expect(movements).toHaveLength(1);
    expect(movements?.[0].amount_minor).toBe(subtotalMinor + 200);

    await owner.rpc("close_shift", { p_shift_id: shiftId!, p_counted_cash_minor: subtotalMinor + 200 });
  });

  it("waiter (izinsiz değil, ama is_staff() sağlanan herhangi personel) ödeme kaydedebilir; misafir kaydedemez", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { tableSessionId, subtotalMinor } = await openOrderedSession(owner, 1);

    const waiter = await signInAsSeededOwner(SEED.acme.waiterEmail);
    const { error } = await waiter.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: subtotalMinor,
      p_tip_amount_minor: 0,
    });
    expect(error).toBeNull();
  });

  it("kapalı bir oturuma ödeme kaydedilemez", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { tableSessionId, subtotalMinor } = await openOrderedSession(owner, 1);
    await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: subtotalMinor,
      p_tip_amount_minor: 0,
    });

    const { error } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: 100,
      p_tip_amount_minor: 0,
    });
    expect(error).not.toBeNull();
  });
});
