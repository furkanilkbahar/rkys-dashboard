import { afterAll, describe, expect, it } from "vitest";

import { createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function setupTenant(prefix: string, giftCardsEnabled = true) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();

  await service.from("tenant_modules").insert([
    { tenant_id: tenant.tenantId, module_key: "pos_cash", is_enabled: true },
    { tenant_id: tenant.tenantId, module_key: "gift_cards", is_enabled: giftCardsEnabled },
  ]);

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenant.tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenant.tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 5000, display_order: 0 });

  const { data: counterTable } = await service
    .from("tables")
    .select("id")
    .eq("tenant_id", tenant.tenantId)
    .eq("branch_id", tenant.branchId)
    .eq("is_counter", true)
    .single();

  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, productId, counterTableId: counterTable!.id as string, owner };
}

async function openOrderedSession(owner: Awaited<ReturnType<typeof signInAsSeededOwner>>, counterTableId: string, productId: string) {
  const { data } = await owner.rpc("submit_staff_order", {
    p_table_id: counterTableId,
    p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }],
  });
  const service = serviceRoleClient();
  const { data: session } = await service.from("table_sessions").select("id").eq("table_id", counterTableId).eq("status", "active").single();
  return { tableSessionId: session!.id as string, subtotalMinor: data![0].subtotal_minor as number };
}

describe("Hediye kartı: oluşturma (Faz 7 Adım 2, S32)", () => {
  it("staff yeni bir hediye kartı oluşturur, ledger'a issue satırı yazılır", async () => {
    const { owner } = await setupTenant("giftcard-issue");
    const { data: giftCardId, error } = await owner.rpc("issue_gift_card", { p_code: "TEST100", p_initial_balance_minor: 10000 });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: card } = await service.from("gift_cards").select("balance_minor").eq("id", giftCardId).single();
    expect(card?.balance_minor).toBe(10000);

    const { data: txns } = await service.from("gift_card_transactions").select("amount_minor, type").eq("gift_card_id", giftCardId);
    expect(txns).toHaveLength(1);
    expect(txns![0]).toEqual({ amount_minor: 10000, type: "issue" });
  });

  it("aynı kod iki kez oluşturulamaz (unique tenant_id+code)", async () => {
    const { owner } = await setupTenant("giftcard-dup");
    await owner.rpc("issue_gift_card", { p_code: "DUPLICATE", p_initial_balance_minor: 5000 });
    const { error } = await owner.rpc("issue_gift_card", { p_code: "DUPLICATE", p_initial_balance_minor: 5000 });
    expect(error).not.toBeNull();
  });

  it("gift_cards modülü kapalıyken oluşturma reddedilir", async () => {
    const { owner } = await setupTenant("giftcard-disabled", false);
    const { error } = await owner.rpc("issue_gift_card", { p_code: "NOPE", p_initial_balance_minor: 5000 });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("gift_cards module not enabled");
  });
});

describe("Hediye kartı: ödeme yöntemi olarak kullanım (Faz 7 Adım 2, S32)", () => {
  it("yeterli bakiyeyle hediye kartıyla ödeme yapılır, bakiye düşer", async () => {
    const { counterTableId, productId, owner } = await setupTenant("giftcard-pay-ok");
    await owner.rpc("issue_gift_card", { p_code: "PAYOK", p_initial_balance_minor: 10000 });
    const { tableSessionId, subtotalMinor } = await openOrderedSession(owner, counterTableId, productId);

    const { error } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "gift_card",
      p_amount_minor: subtotalMinor,
      p_gift_card_code: "PAYOK",
    });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: card } = await service.from("gift_cards").select("balance_minor").eq("code", "PAYOK").single();
    expect(card?.balance_minor).toBe(10000 - subtotalMinor);

    const { data: session } = await service.from("table_sessions").select("status").eq("id", tableSessionId).single();
    expect(session?.status).toBe("closed");
  });

  it("yetersiz bakiyeyle ödeme reddedilir, bakiye değişmez", async () => {
    const { counterTableId, productId, owner } = await setupTenant("giftcard-pay-insufficient");
    await owner.rpc("issue_gift_card", { p_code: "LOWBAL", p_initial_balance_minor: 1000 });
    const { tableSessionId, subtotalMinor } = await openOrderedSession(owner, counterTableId, productId);

    const { error } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "gift_card",
      p_amount_minor: subtotalMinor,
      p_gift_card_code: "LOWBAL",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("insufficient gift card balance");

    const service = serviceRoleClient();
    const { data: card } = await service.from("gift_cards").select("balance_minor").eq("code", "LOWBAL").single();
    expect(card?.balance_minor).toBe(1000);
  });

  it("geçersiz kod reddedilir", async () => {
    const { counterTableId, productId, owner } = await setupTenant("giftcard-invalid-code");
    const { tableSessionId, subtotalMinor } = await openOrderedSession(owner, counterTableId, productId);

    const { error } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "gift_card",
      p_amount_minor: subtotalMinor,
      p_gift_card_code: "DOESNOTEXIST",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("invalid gift card code");
  });

  it("mevcut nakit/kart akışları (p_gift_card_code verilmeden) regresyonsuz çalışır", async () => {
    const { counterTableId, productId, owner } = await setupTenant("giftcard-cash-regression");
    const { tableSessionId, subtotalMinor } = await openOrderedSession(owner, counterTableId, productId);

    const { error } = await owner.rpc("record_payment", {
      p_table_session_id: tableSessionId,
      p_method: "cash",
      p_amount_minor: subtotalMinor,
    });
    expect(error).toBeNull();
  });
});

describe("Hediye kartı RLS (Faz 7 Adım 2, S32)", () => {
  it("başka bir tenant'ın hediye kartı görülemez", async () => {
    const { owner: ownerA } = await setupTenant("giftcard-rls-a");
    const { owner: ownerB } = await setupTenant("giftcard-rls-b");
    await ownerA.rpc("issue_gift_card", { p_code: "TENANTA", p_initial_balance_minor: 5000 });

    const { data } = await ownerB.from("gift_cards").select("id").eq("code", "TENANTA");
    expect(data).toHaveLength(0);
  });
});
