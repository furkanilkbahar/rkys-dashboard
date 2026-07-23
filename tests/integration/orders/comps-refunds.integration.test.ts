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
  return {
    tableSessionId: session!.id as string,
    orderId: data![0].order_id as string,
    subtotalMinor: data![0].subtotal_minor as number,
  };
}

async function getReasonCodeId(category: "comp" | "refund") {
  const service = serviceRoleClient();
  const { data } = await service
    .from("reason_codes")
    .select("id")
    .eq("tenant_id", SEED.acme.tenantId)
    .eq("category", category)
    .eq("is_active", true)
    .limit(1)
    .single();
  return data!.id as string;
}

describe("RPC: record_comp (S10)", () => {
  it("waiter (comp_discount izni yok) ikram uygulayamaz", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { orderId } = await openOrderedSession(owner, 1);
    const reasonCodeId = await getReasonCodeId("comp");

    const waiter = await signInAsSeededOwner(SEED.acme.waiterEmail);
    const { error } = await waiter.rpc("record_comp", {
      p_order_id: orderId,
      p_amount_minor: 1000,
      p_reason_code_id: reasonCodeId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("forbidden");
  });

  it("sebep kodu olmadan ikram kaydedilemez (RULES #35)", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { orderId } = await openOrderedSession(owner, 1);

    const { error } = await owner.rpc("record_comp", {
      p_order_id: orderId,
      p_amount_minor: 1000,
      p_reason_code_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("invalid reason code");
  });

  it("yanlış kategorideki (refund) sebep kodu comp için reddedilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { orderId } = await openOrderedSession(owner, 1);
    const refundReasonId = await getReasonCodeId("refund");

    const { error } = await owner.rpc("record_comp", {
      p_order_id: orderId,
      p_amount_minor: 1000,
      p_reason_code_id: refundReasonId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("invalid reason code");
  });

  it("sipariş subtotal'ını aşan ikram reddedilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { orderId, subtotalMinor } = await openOrderedSession(owner, 1);
    const reasonCodeId = await getReasonCodeId("comp");

    const { error } = await owner.rpc("record_comp", {
      p_order_id: orderId,
      p_amount_minor: subtotalMinor + 1,
      p_reason_code_id: reasonCodeId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("exceeds order subtotal");
  });

  it("geçerli ikram uygulanır ve oturumun kalan bakiyesini düşürür — kayıp-kaçak izlenebilir kalır", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { tableSessionId, orderId } = await openOrderedSession(owner, 1); // 8000
    const reasonCodeId = await getReasonCodeId("comp");
    const compAmount = 2000;

    const { data: compId, error } = await owner.rpc("record_comp", {
      p_order_id: orderId,
      p_amount_minor: compAmount,
      p_reason_code_id: reasonCodeId,
      p_note: "test ikram",
    });
    expect(error).toBeNull();
    expect(compId).toBeTruthy();

    const service = serviceRoleClient();
    const { data: comp } = await service.from("comps").select("order_id, amount_minor, reason_code_id").eq("id", compId!).single();
    expect(comp?.order_id).toBe(orderId);
    expect(comp?.amount_minor).toBe(compAmount);

    // Bu describe bloğundaki önceki testler aynı tezgah masasının hâlâ açık
    // oturumuna sipariş eklemiş olabilir (hiçbiri ödemeyi tamamlamadı) — oturumun
    // GERÇEK toplam bakiyesi sorgulanır, tek bir siparişin subtotal'ı varsayılmaz.
    const { data: orders } = await service
      .from("orders")
      .select("subtotal_minor")
      .eq("table_session_id", tableSessionId)
      .neq("status", "cancelled");
    const sessionSubtotal = orders!.reduce((sum, o) => sum + o.subtotal_minor, 0);

    // İkram düşülmüş tutar tam ödenince oturum kapanmalı (record_payment 0033 güncellemesi).
    const { error: payError } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: sessionSubtotal - compAmount,
      p_tip_amount_minor: 0,
    });
    expect(payError).toBeNull();

    const { data: session } = await service.from("table_sessions").select("status, close_reason").eq("id", tableSessionId).single();
    expect(session?.status).toBe("closed");
    expect(session?.close_reason).toBe("payment");
  });
});

describe("RPC: record_refund (S11)", () => {
  it("waiter (refund izni yok) iade yapamaz", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { tableSessionId, subtotalMinor } = await openOrderedSession(owner, 1);
    const { data: paymentId } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: subtotalMinor,
      p_tip_amount_minor: 0,
    });
    const reasonCodeId = await getReasonCodeId("refund");

    const waiter = await signInAsSeededOwner(SEED.acme.waiterEmail);
    const { error } = await waiter.rpc("record_refund", {
      p_payment_id: paymentId!,
      p_amount_minor: subtotalMinor,
      p_reason_code_id: reasonCodeId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("forbidden");
  });

  it("kasa (nakit) ödeme iadesi: manuel kayıt + açık vardiyanın kasa hareketine 'refund' yazılır", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: shiftId } = await owner.rpc("open_shift", { p_branch_id: SEED.acme.branchId, p_opening_balance_minor: 0 });

    const { tableSessionId, subtotalMinor } = await openOrderedSession(owner, 1);
    const { data: paymentId } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: subtotalMinor,
      p_tip_amount_minor: 300,
    });
    const reasonCodeId = await getReasonCodeId("refund");

    const { data: refundId, error } = await owner.rpc("record_refund", {
      p_payment_id: paymentId!,
      p_amount_minor: subtotalMinor + 300,
      p_reason_code_id: reasonCodeId,
      p_note: "müşteri şikayeti",
    });
    expect(error).toBeNull();
    expect(refundId).toBeTruthy();

    const service = serviceRoleClient();
    const { data: refund } = await service.from("refunds").select("amount_minor, provider_ref").eq("id", refundId!).single();
    expect(refund?.amount_minor).toBe(subtotalMinor + 300); // tam iade: tutar + bahşiş
    expect(refund?.provider_ref).toBeNull(); // kasa iadesi: sağlayıcı çağrısı yok

    const { data: payment } = await service.from("payments").select("status").eq("id", paymentId!).single();
    expect(payment?.status).toBe("refunded");

    const { data: movements } = await service
      .from("cash_movements")
      .select("movement_type, amount_minor")
      .eq("cash_shift_id", shiftId!)
      .eq("movement_type", "refund");
    expect(movements).toHaveLength(1);
    expect(movements?.[0].amount_minor).toBe(subtotalMinor + 300);

    await owner.rpc("close_shift", { p_shift_id: shiftId!, p_counted_cash_minor: 0 });
  });

  it("online ödeme iadesinde provider_ref kaydedilir (app katmanı provider.refund() sonucunu taşır)", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { tableSessionId } = await openOrderedSession(owner, 1);
    const service = serviceRoleClient();

    // record_payment yalnız cash/card_manual kabul eder; online ödeme create_pending/complete akışıyla oluşur (0032).
    const providerRef = crypto.randomUUID();
    await owner.rpc("create_pending_online_payment", {
      p_table_session_id: tableSessionId,
      p_amount_minor: 8000,
      p_tip_amount_minor: 0,
      p_provider: "mock",
      p_provider_ref: providerRef,
    });
    await service.rpc("complete_online_payment", { p_provider: "mock", p_provider_ref: providerRef });
    const { data: payment } = await service.from("payments").select("id").eq("provider_ref", providerRef).single();

    const reasonCodeId = await getReasonCodeId("refund");
    const mockRefundRef = `mock-refund-${providerRef}`;
    const { data: refundId, error } = await owner.rpc("record_refund", {
      p_payment_id: payment!.id,
      p_amount_minor: 8000,
      p_reason_code_id: reasonCodeId,
      p_provider_ref: mockRefundRef,
    });
    expect(error).toBeNull();

    const { data: refund } = await service.from("refunds").select("provider_ref").eq("id", refundId!).single();
    expect(refund?.provider_ref).toBe(mockRefundRef);
  });

  it("zaten iade edilmiş bir ödeme tekrar iade edilemez", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { tableSessionId, subtotalMinor } = await openOrderedSession(owner, 1);
    const { data: paymentId } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: subtotalMinor,
      p_tip_amount_minor: 0,
    });
    const reasonCodeId = await getReasonCodeId("refund");

    const { error: firstError } = await owner.rpc("record_refund", {
      p_payment_id: paymentId!,
      p_amount_minor: subtotalMinor,
      p_reason_code_id: reasonCodeId,
    });
    expect(firstError).toBeNull();

    const { error: secondError } = await owner.rpc("record_refund", {
      p_payment_id: paymentId!,
      p_amount_minor: subtotalMinor,
      p_reason_code_id: reasonCodeId,
    });
    expect(secondError).not.toBeNull();
    expect(secondError?.message).toContain("not refundable");
  });

  it("RLS: comps ve refunds yalnızca kendi tenant'ının personeline görünür", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: comps, error: compsError } = await owner.from("comps").select("tenant_id");
    expect(compsError).toBeNull();
    expect(comps?.every((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);

    const { data: refunds, error: refundsError } = await owner.from("refunds").select("tenant_id");
    expect(refundsError).toBeNull();
    expect(refunds?.every((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);
  });
});
