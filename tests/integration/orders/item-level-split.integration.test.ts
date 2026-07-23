import { afterAll, describe, expect, it } from "vitest";

import { createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function setupTenantWithTwoProducts(prefix: string) {
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

  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, productAId, productBId, counterTableId: counterTable!.id as string, owner };
}

async function orderTwoProducts(
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
  const { data: session } = await service
    .from("table_sessions")
    .select("id")
    .eq("table_id", counterTableId)
    .eq("status", "active")
    .single();
  const { data: items } = await service
    .from("order_items")
    .select("id, product_id, line_subtotal_minor")
    .eq("order_id", orderRow.order_id);

  return {
    tableSessionId: session!.id as string,
    subtotalMinor: orderRow.subtotal_minor as number,
    itemA: items!.find((i) => i.product_id === productAId)!,
    itemB: items!.find((i) => i.product_id === productBId)!,
  };
}

describe("record_payment: kalem bazlı ödeme (Faz 6 Adım 0, S25)", () => {
  it("kalem allocation toplamı p_amount_minor'a eşit değilse reddedilir", async () => {
    const { counterTableId, productAId, productBId, owner } = await setupTenantWithTwoProducts("item-split-mismatch");
    const { tableSessionId, itemA } = await orderTwoProducts(owner, counterTableId, productAId, productBId);

    const { error } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: 3000,
      p_item_allocations: [{ orderItemId: itemA.id, quantity: 1, amountMinor: 2000 }],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("do not match amount");
  });

  it("başka bir oturuma ait sipariş kalemine allocation yapılamaz", async () => {
    const tenantA = await setupTenantWithTwoProducts("item-split-cross-a");
    const tenantB = await setupTenantWithTwoProducts("item-split-cross-b");
    const { itemA: foreignItem } = await orderTwoProducts(tenantB.owner, tenantB.counterTableId, tenantB.productAId, tenantB.productBId);
    const { tableSessionId } = await orderTwoProducts(tenantA.owner, tenantA.counterTableId, tenantA.productAId, tenantA.productBId);

    const { error } = await tenantA.owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: foreignItem.line_subtotal_minor,
      p_item_allocations: [{ orderItemId: foreignItem.id, quantity: 1, amountMinor: foreignItem.line_subtotal_minor }],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("invalid order item allocation");
  });

  it("geçerli kalem seçimiyle ödeme kaydedilir, payment_item_allocations doğru yazılır", async () => {
    const { counterTableId, productAId, productBId, owner } = await setupTenantWithTwoProducts("item-split-valid");
    const { tableSessionId, itemA } = await orderTwoProducts(owner, counterTableId, productAId, productBId);

    const { data: paymentId, error } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: itemA.line_subtotal_minor,
      p_item_allocations: [{ orderItemId: itemA.id, quantity: 1, amountMinor: itemA.line_subtotal_minor }],
    });
    expect(error).toBeNull();
    expect(paymentId).toBeTruthy();

    const service = serviceRoleClient();
    const { data: allocations } = await service
      .from("payment_item_allocations")
      .select("order_item_id, quantity, amount_minor")
      .eq("payment_id", paymentId!);
    expect(allocations).toHaveLength(1);
    expect(allocations![0].order_item_id).toBe(itemA.id);
    expect(allocations![0].amount_minor).toBe(itemA.line_subtotal_minor);

    // Session henüz tam ödenmedi (yalnızca A ödendi, B kaldı) — açık kalmalı.
    const { data: session } = await service.from("table_sessions").select("status").eq("id", tableSessionId).single();
    expect(session?.status).toBe("active");
  });

  it("aynı kalem sipariş miktarından fazla ödenmeye çalışılırsa (ör. zaten ödenmiş kalem tekrar seçilirse) reddedilir", async () => {
    const { counterTableId, productAId, productBId, owner } = await setupTenantWithTwoProducts("item-split-overpay");
    const { tableSessionId, itemA } = await orderTwoProducts(owner, counterTableId, productAId, productBId);

    const { error: firstError } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: itemA.line_subtotal_minor,
      p_item_allocations: [{ orderItemId: itemA.id, quantity: 1, amountMinor: itemA.line_subtotal_minor }],
    });
    expect(firstError).toBeNull();

    const { error: secondError } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: itemA.line_subtotal_minor,
      p_item_allocations: [{ orderItemId: itemA.id, quantity: 1, amountMinor: itemA.line_subtotal_minor }],
    });
    expect(secondError).not.toBeNull();
    expect(secondError?.message).toContain("exceeds ordered quantity");
  });

  it("mevcut düz-tutar ödeme akışı (kalem seçimsiz, split_group dahil) regresyonsuz çalışır", async () => {
    const { counterTableId, productAId, productBId, owner } = await setupTenantWithTwoProducts("item-split-flat-regression");
    const { tableSessionId, subtotalMinor } = await orderTwoProducts(owner, counterTableId, productAId, productBId);
    const splitGroup = crypto.randomUUID();

    const { data: paymentId, error } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: subtotalMinor,
      p_split_group: splitGroup,
    });
    expect(error).toBeNull();
    expect(paymentId).toBeTruthy();

    const service = serviceRoleClient();
    const { data: allocations } = await service.from("payment_item_allocations").select("id").eq("payment_id", paymentId!);
    expect(allocations).toHaveLength(0);

    const { data: session } = await service.from("table_sessions").select("status, close_reason").eq("id", tableSessionId).single();
    expect(session?.status).toBe("closed");
    expect(session?.close_reason).toBe("payment");
  });
});
