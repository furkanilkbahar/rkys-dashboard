import { afterAll, describe, expect, it } from "vitest";

import { createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function setupTenant(prefix: string) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();

  await service.from("tenant_modules").insert({ tenant_id: tenant.tenantId, module_key: "pos_cash", is_enabled: true });

  const categoryId = crypto.randomUUID();
  const productAId = crypto.randomUUID();
  const productBId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenant.tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert([
    { id: productAId, tenant_id: tenant.tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 3000, display_order: 0 },
    { id: productBId, tenant_id: tenant.tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 5000, display_order: 1 },
  ]);

  const { data: counterTable } = await service
    .from("tables")
    .select("id")
    .eq("tenant_id", tenant.tenantId)
    .eq("branch_id", tenant.branchId)
    .eq("is_counter", true)
    .single();

  const refundReasonId = crypto.randomUUID();
  await service.from("reason_codes").insert({ id: refundReasonId, tenant_id: tenant.tenantId, category: "refund", key: "test_refund", display_order: 0 });

  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, productAId, productBId, counterTableId: counterTable!.id as string, owner, refundReasonId };
}

async function orderAndPayFlat(
  owner: Awaited<ReturnType<typeof signInAsSeededOwner>>,
  counterTableId: string,
  productId: string,
) {
  const { data } = await owner.rpc("submit_staff_order", {
    p_table_id: counterTableId,
    p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }],
  });
  const orderRow = data![0];
  const service = serviceRoleClient();
  const { data: session } = await service
    .from("table_sessions")
    .select("id")
    .eq("table_id", counterTableId)
    .eq("status", "active")
    .single();

  const { data: paymentId } = await owner.rpc("record_payment", {
    p_table_session_id: session!.id,
    p_method: "cash",
    p_amount_minor: orderRow.subtotal_minor,
    p_tip_amount_minor: 0,
  });
  return { paymentId: paymentId as string, amountMinor: orderRow.subtotal_minor as number };
}

async function orderAndPayByItems(
  owner: Awaited<ReturnType<typeof signInAsSeededOwner>>,
  counterTableId: string,
  productAId: string,
  productBId: string,
) {
  const { data } = await owner.rpc("submit_staff_order", {
    p_table_id: counterTableId,
    p_items: [
      { productId: productAId, variantId: null, quantity: 1, extraIds: [] },
      { productId: productBId, variantId: null, quantity: 1, extraIds: [] },
    ],
  });
  const orderRow = data![0];
  const service = serviceRoleClient();
  const { data: items } = await service.from("order_items").select("id, product_id, line_subtotal_minor").eq("order_id", orderRow.order_id);
  const itemA = items!.find((i) => i.product_id === productAId)!;
  const itemB = items!.find((i) => i.product_id === productBId)!;

  const { data: paymentId } = await owner.rpc("record_payment", {
    p_table_session_id: (await service.from("table_sessions").select("id").eq("table_id", counterTableId).eq("status", "active").single()).data!.id,
    p_method: "cash",
    p_amount_minor: orderRow.subtotal_minor,
    p_item_allocations: [
      { orderItemId: itemA.id, quantity: 1, amountMinor: itemA.line_subtotal_minor },
      { orderItemId: itemB.id, quantity: 1, amountMinor: itemB.line_subtotal_minor },
    ],
  });
  return { paymentId: paymentId as string, itemA, itemB };
}

describe("record_refund: kısmi/kalem iade (Faz 6 Adım 1, S26)", () => {
  it("kısmi iade tutarı payment toplamını aşarsa reddedilir", async () => {
    const { counterTableId, productAId, owner, refundReasonId } = await setupTenant("partial-refund-exceeds");
    const { paymentId, amountMinor } = await orderAndPayFlat(owner, counterTableId, productAId);

    const { error } = await owner.rpc("record_refund", {
      p_payment_id: paymentId,
      p_amount_minor: amountMinor + 1,
      p_reason_code_id: refundReasonId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("exceeds remaining payment balance");
  });

  it("kısmi iade sonra ödeme 'partially_refunded' olur, kalan tutar kadar ikinci iade tam tutara tamamlar ve 'refunded' yapar", async () => {
    const { counterTableId, productAId, owner, refundReasonId } = await setupTenant("partial-refund-two-step");
    const { paymentId, amountMinor } = await orderAndPayFlat(owner, counterTableId, productAId);
    const service = serviceRoleClient();

    const half = Math.floor(amountMinor / 2);
    const { error: firstError } = await owner.rpc("record_refund", {
      p_payment_id: paymentId,
      p_amount_minor: half,
      p_reason_code_id: refundReasonId,
    });
    expect(firstError).toBeNull();

    const { data: afterFirst } = await service.from("payments").select("status").eq("id", paymentId).single();
    expect(afterFirst?.status).toBe("partially_refunded");

    const remaining = amountMinor - half;
    const { error: secondError } = await owner.rpc("record_refund", {
      p_payment_id: paymentId,
      p_amount_minor: remaining,
      p_reason_code_id: refundReasonId,
    });
    expect(secondError).toBeNull();

    const { data: afterSecond } = await service.from("payments").select("status").eq("id", paymentId).single();
    expect(afterSecond?.status).toBe("refunded");

    const { data: refunds } = await service.from("refunds").select("amount_minor").eq("payment_id", paymentId);
    expect(refunds).toHaveLength(2);
    expect(refunds!.reduce((sum, r) => sum + r.amount_minor, 0)).toBe(amountMinor);
  });

  it("üçüncü iade denemesi (zaten tam iade edilmiş) reddedilir", async () => {
    const { counterTableId, productAId, owner, refundReasonId } = await setupTenant("partial-refund-already-full");
    const { paymentId, amountMinor } = await orderAndPayFlat(owner, counterTableId, productAId);

    await owner.rpc("record_refund", { p_payment_id: paymentId, p_amount_minor: amountMinor, p_reason_code_id: refundReasonId });

    const { error } = await owner.rpc("record_refund", { p_payment_id: paymentId, p_amount_minor: 1, p_reason_code_id: refundReasonId });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("not refundable");
  });

  it("kalem bazlı iade: yalnızca bu ödemeye ait allocation'lardan, ödenmiş miktarı aşmadan iade edilebilir", async () => {
    const { counterTableId, productAId, productBId, owner, refundReasonId } = await setupTenant("partial-refund-items");
    const { paymentId, itemA, itemB } = await orderAndPayByItems(owner, counterTableId, productAId, productBId);
    const service = serviceRoleClient();

    // Yalnızca A'yı iade et.
    const { data: refundId, error } = await owner.rpc("record_refund", {
      p_payment_id: paymentId,
      p_amount_minor: itemA.line_subtotal_minor,
      p_reason_code_id: refundReasonId,
      p_item_allocations: [{ orderItemId: itemA.id, quantity: 1, amountMinor: itemA.line_subtotal_minor }],
    });
    expect(error).toBeNull();

    const { data: allocations } = await service.from("refund_item_allocations").select("order_item_id").eq("refund_id", refundId!);
    expect(allocations).toHaveLength(1);
    expect(allocations![0].order_item_id).toBe(itemA.id);

    const { data: afterFirst } = await service.from("payments").select("status").eq("id", paymentId).single();
    expect(afterFirst?.status).toBe("partially_refunded");

    // A'yı TEKRAR iade etmeye çalışmak (zaten tamamen iade edilmiş kalem) reddedilir.
    const { error: doubleRefundError } = await owner.rpc("record_refund", {
      p_payment_id: paymentId,
      p_amount_minor: itemA.line_subtotal_minor,
      p_reason_code_id: refundReasonId,
      p_item_allocations: [{ orderItemId: itemA.id, quantity: 1, amountMinor: itemA.line_subtotal_minor }],
    });
    expect(doubleRefundError).not.toBeNull();
    expect(doubleRefundError?.message).toContain("item refund exceeds paid quantity");

    // B'yi iade edince ödeme tamamen iade edilmiş olur.
    const { error: secondError } = await owner.rpc("record_refund", {
      p_payment_id: paymentId,
      p_amount_minor: itemB.line_subtotal_minor,
      p_reason_code_id: refundReasonId,
      p_item_allocations: [{ orderItemId: itemB.id, quantity: 1, amountMinor: itemB.line_subtotal_minor }],
    });
    expect(secondError).toBeNull();
    const { data: afterSecond } = await service.from("payments").select("status").eq("id", paymentId).single();
    expect(afterSecond?.status).toBe("refunded");
  });

  it("mevcut tam-iade akışı (kalem seçimsiz) regresyonsuz çalışır", async () => {
    const { counterTableId, productAId, owner, refundReasonId } = await setupTenant("partial-refund-full-regression");
    const { paymentId, amountMinor } = await orderAndPayFlat(owner, counterTableId, productAId);
    const service = serviceRoleClient();

    const { data: refundId, error } = await owner.rpc("record_refund", {
      p_payment_id: paymentId,
      p_amount_minor: amountMinor,
      p_reason_code_id: refundReasonId,
    });
    expect(error).toBeNull();

    const { data: refund } = await service.from("refunds").select("amount_minor").eq("id", refundId!).single();
    expect(refund?.amount_minor).toBe(amountMinor);

    const { data: payment } = await service.from("payments").select("status").eq("id", paymentId).single();
    expect(payment?.status).toBe("refunded");
  });
});
