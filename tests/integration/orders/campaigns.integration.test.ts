import { afterAll, describe, expect, it } from "vitest";

import type { Json } from "@/lib/supabase/types";

import { bootstrapGuestForTable, createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

function istanbulHourNow(): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", hour: "numeric", hourCycle: "h23" }).format(new Date()));
}

async function setupTenant(prefix: string, campaignsEnabled = true) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();

  await service.from("tenant_modules").insert([
    { tenant_id: tenant.tenantId, module_key: "pos_cash", is_enabled: true },
    { tenant_id: tenant.tenantId, module_key: "campaigns", is_enabled: campaignsEnabled },
  ]);

  const categoryId = crypto.randomUUID();
  const categoryBId = crypto.randomUUID();
  const productAId = crypto.randomUUID();
  const productBId = crypto.randomUUID();
  await service.from("menu_categories").insert([
    { id: categoryId, tenant_id: tenant.tenantId, layout: "grid", display_order: 0 },
    { id: categoryBId, tenant_id: tenant.tenantId, layout: "grid", display_order: 1 },
  ]);
  await service.from("products").insert([
    { id: productAId, tenant_id: tenant.tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 5000, display_order: 0 },
    { id: productBId, tenant_id: tenant.tenantId, category_id: categoryBId, track_mode: "simple", base_price_minor: 3000, display_order: 0 },
  ]);

  const { data: counterTable } = await service
    .from("tables")
    .select("id")
    .eq("tenant_id", tenant.tenantId)
    .eq("branch_id", tenant.branchId)
    .eq("is_counter", true)
    .single();

  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, categoryId, categoryBId, productAId, productBId, counterTableId: counterTable!.id as string, owner };
}

async function placeStaffOrder(
  owner: Awaited<ReturnType<typeof signInAsSeededOwner>>,
  counterTableId: string,
  items: { productId: string; quantity: number }[],
) {
  const { data } = await owner.rpc("submit_staff_order", {
    p_table_id: counterTableId,
    p_items: items.map((i) => ({ productId: i.productId, variantId: null, quantity: i.quantity, extraIds: [] })),
  });
  return { orderId: data![0].order_id as string, subtotalMinor: data![0].subtotal_minor as number };
}

async function createCampaignAndCoupon(
  tenantId: string,
  overrides: {
    ruleType: string;
    ruleConfig: Record<string, unknown>;
    code: string;
    usageLimit?: number;
    isActive?: boolean;
    campaignIsActive?: boolean;
    startsAt?: string;
    endsAt?: string;
  },
) {
  const service = serviceRoleClient();
  const campaignId = crypto.randomUUID();
  await service.from("campaigns").insert({
    id: campaignId,
    tenant_id: tenantId,
    name: `Test ${overrides.ruleType}`,
    rule_type: overrides.ruleType,
    rule_config: overrides.ruleConfig as Json,
    is_active: overrides.campaignIsActive ?? true,
    starts_at: overrides.startsAt ?? null,
    ends_at: overrides.endsAt ?? null,
  });
  await service.from("coupons").insert({
    tenant_id: tenantId,
    campaign_id: campaignId,
    code: overrides.code,
    usage_limit: overrides.usageLimit ?? null,
    is_active: overrides.isActive ?? true,
  });
  return campaignId;
}

describe("apply_coupon_to_order: kural tipleri (Faz 6 Adım 2, S27)", () => {
  it("percentage_off: subtotal'ın doğru yüzdesi kadar indirim uygulanır", async () => {
    const { tenantId, counterTableId, productAId, owner } = await setupTenant("campaign-percentage");
    const { orderId, subtotalMinor } = await placeStaffOrder(owner, counterTableId, [{ productId: productAId, quantity: 1 }]);
    await createCampaignAndCoupon(tenantId, { ruleType: "percentage_off", ruleConfig: { percentage: 20 }, code: "PCT20" });

    const { data: discount, error } = await owner.rpc("apply_coupon_to_order", { p_order_id: orderId, p_code: "PCT20" });
    expect(error).toBeNull();
    expect(discount).toBe(Math.floor(subtotalMinor * 0.2));

    const service = serviceRoleClient();
    const { data: comps } = await service.from("comps").select("amount_minor").eq("order_id", orderId);
    expect(comps).toHaveLength(1);
    expect(comps![0].amount_minor).toBe(discount);
  });

  it("bogo: ürün 2+ adet siparişte en ucuz (tek) birim bedava; 1 adette indirim yok", async () => {
    const { tenantId, counterTableId, productAId, owner } = await setupTenant("campaign-bogo");
    await createCampaignAndCoupon(tenantId, { ruleType: "bogo", ruleConfig: { productId: productAId }, code: "BOGO1" });

    const { orderId: singleOrderId } = await placeStaffOrder(owner, counterTableId, [{ productId: productAId, quantity: 1 }]);
    const { error: singleError } = await owner.rpc("apply_coupon_to_order", { p_order_id: singleOrderId, p_code: "BOGO1" });
    expect(singleError).not.toBeNull();
    expect(singleError?.message).toContain("not applicable");

    const { orderId: doubleOrderId } = await placeStaffOrder(owner, counterTableId, [{ productId: productAId, quantity: 2 }]);
    const { data: discount, error: doubleError } = await owner.rpc("apply_coupon_to_order", { p_order_id: doubleOrderId, p_code: "BOGO1" });
    expect(doubleError).toBeNull();
    expect(discount).toBe(5000);
  });

  it("category_discount: yalnızca o kategorideki kalemlerin toplamına yüzde uygulanır", async () => {
    const { tenantId, counterTableId, productAId, productBId, categoryId, owner } = await setupTenant("campaign-category");
    await createCampaignAndCoupon(tenantId, {
      ruleType: "category_discount",
      ruleConfig: { categoryId, percentage: 50 },
      code: "CATHALF",
    });

    const { orderId } = await placeStaffOrder(owner, counterTableId, [
      { productId: productAId, quantity: 1 }, // categoryId'de, 5000
      { productId: productBId, quantity: 1 }, // categoryBId'de, 3000 — indirime dahil değil
    ]);

    const { data: discount, error } = await owner.rpc("apply_coupon_to_order", { p_order_id: orderId, p_code: "CATHALF" });
    expect(error).toBeNull();
    expect(discount).toBe(2500); // yalnızca A'nın 5000'inin %50'si
  });

  it("time_window: mevcut saat aralık içindeyken indirim uygulanır, dışındayken reddedilir", async () => {
    const { tenantId, counterTableId, productAId, owner } = await setupTenant("campaign-time-window");
    const currentHour = istanbulHourNow();
    const outsideHour = (currentHour + 12) % 24;

    await createCampaignAndCoupon(tenantId, {
      ruleType: "time_window",
      ruleConfig: { startHour: currentHour, endHour: currentHour, percentage: 10 },
      code: "HAPPYHOUR",
    });
    await createCampaignAndCoupon(tenantId, {
      ruleType: "time_window",
      ruleConfig: { startHour: outsideHour, endHour: outsideHour, percentage: 10 },
      code: "WRONGHOUR",
    });

    const { orderId: order1 } = await placeStaffOrder(owner, counterTableId, [{ productId: productAId, quantity: 1 }]);
    const { data: discount, error } = await owner.rpc("apply_coupon_to_order", { p_order_id: order1, p_code: "HAPPYHOUR" });
    expect(error).toBeNull();
    expect(discount).toBe(500);

    const { orderId: order2 } = await placeStaffOrder(owner, counterTableId, [{ productId: productAId, quantity: 1 }]);
    const { error: wrongHourError } = await owner.rpc("apply_coupon_to_order", { p_order_id: order2, p_code: "WRONGHOUR" });
    expect(wrongHourError).not.toBeNull();
    expect(wrongHourError?.message).toContain("not applicable");
  });
});

describe("apply_coupon_to_order: limit/süre/tekrar-kullanım/modül (Faz 6 Adım 2, S27)", () => {
  it("kullanım limiti dolan kupon reddedilir", async () => {
    const { tenantId, counterTableId, productAId, owner } = await setupTenant("campaign-limit");
    await createCampaignAndCoupon(tenantId, { ruleType: "percentage_off", ruleConfig: { percentage: 10 }, code: "LIMIT1", usageLimit: 1 });

    const { orderId: order1 } = await placeStaffOrder(owner, counterTableId, [{ productId: productAId, quantity: 1 }]);
    const { error: firstError } = await owner.rpc("apply_coupon_to_order", { p_order_id: order1, p_code: "LIMIT1" });
    expect(firstError).toBeNull();

    const { orderId: order2 } = await placeStaffOrder(owner, counterTableId, [{ productId: productAId, quantity: 1 }]);
    const { error: secondError } = await owner.rpc("apply_coupon_to_order", { p_order_id: order2, p_code: "LIMIT1" });
    expect(secondError).not.toBeNull();
    expect(secondError?.message).toContain("usage limit reached");
  });

  it("aynı kupon aynı siparişe iki kez uygulanamaz", async () => {
    const { tenantId, counterTableId, productAId, owner } = await setupTenant("campaign-reuse");
    await createCampaignAndCoupon(tenantId, { ruleType: "percentage_off", ruleConfig: { percentage: 10 }, code: "ONCE" });
    const { orderId } = await placeStaffOrder(owner, counterTableId, [{ productId: productAId, quantity: 1 }]);

    const { error: firstError } = await owner.rpc("apply_coupon_to_order", { p_order_id: orderId, p_code: "ONCE" });
    expect(firstError).toBeNull();

    const { error: secondError } = await owner.rpc("apply_coupon_to_order", { p_order_id: orderId, p_code: "ONCE" });
    expect(secondError).not.toBeNull();
    expect(secondError?.message).toContain("already applied");
  });

  it("pasif kupon / pasif kampanya / henüz başlamamış / süresi geçmiş kampanya reddedilir", async () => {
    const { tenantId, counterTableId, productAId, owner } = await setupTenant("campaign-inactive");
    await createCampaignAndCoupon(tenantId, { ruleType: "percentage_off", ruleConfig: { percentage: 10 }, code: "INACTIVECOUPON", isActive: false });
    await createCampaignAndCoupon(tenantId, {
      ruleType: "percentage_off",
      ruleConfig: { percentage: 10 },
      code: "INACTIVECAMPAIGN",
      campaignIsActive: false,
    });
    await createCampaignAndCoupon(tenantId, {
      ruleType: "percentage_off",
      ruleConfig: { percentage: 10 },
      code: "NOTSTARTED",
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    await createCampaignAndCoupon(tenantId, {
      ruleType: "percentage_off",
      ruleConfig: { percentage: 10 },
      code: "EXPIRED",
      endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });

    for (const [code, expectedMessage] of [
      ["INACTIVECOUPON", "invalid coupon code"],
      ["INACTIVECAMPAIGN", "campaign not active"],
      ["NOTSTARTED", "campaign not started"],
      ["EXPIRED", "campaign ended"],
    ] as const) {
      const { orderId } = await placeStaffOrder(owner, counterTableId, [{ productId: productAId, quantity: 1 }]);
      const { error } = await owner.rpc("apply_coupon_to_order", { p_order_id: orderId, p_code: code });
      expect(error, code).not.toBeNull();
      expect(error?.message, code).toContain(expectedMessage);
    }
  });

  it("campaigns modülü kapalıyken RPC reddeder", async () => {
    const { tenantId, counterTableId, productAId, owner } = await setupTenant("campaign-module-disabled", false);
    await createCampaignAndCoupon(tenantId, { ruleType: "percentage_off", ruleConfig: { percentage: 10 }, code: "MODOFF" });

    const { orderId } = await placeStaffOrder(owner, counterTableId, [{ productId: productAId, quantity: 1 }]);
    const { error } = await owner.rpc("apply_coupon_to_order", { p_order_id: orderId, p_code: "MODOFF" });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("campaigns module not enabled");
  });

  it("indirim, siparişin subtotal'ını (varsa önceki ikramlar düşülerek) aşamaz", async () => {
    const { tenantId, counterTableId, productAId, owner } = await setupTenant("campaign-cap");
    await createCampaignAndCoupon(tenantId, { ruleType: "percentage_off", ruleConfig: { percentage: 100 }, code: "FULLOFF" });
    const { orderId, subtotalMinor } = await placeStaffOrder(owner, counterTableId, [{ productId: productAId, quantity: 1 }]);

    const { data: discount, error } = await owner.rpc("apply_coupon_to_order", { p_order_id: orderId, p_code: "FULLOFF" });
    expect(error).toBeNull();
    expect(discount).toBe(subtotalMinor);

    await createCampaignAndCoupon(tenantId, { ruleType: "percentage_off", ruleConfig: { percentage: 10 }, code: "TOOMUCH" });
    const { error: overCapError } = await owner.rpc("apply_coupon_to_order", { p_order_id: orderId, p_code: "TOOMUCH" });
    expect(overCapError).not.toBeNull();
    expect(overCapError?.message).toContain("already fully comped");
  });

  it("misafir yalnızca kendi oturumunun siparişine kupon uygulayabilir", async () => {
    const tenantA = await setupTenant("campaign-guest-a");
    const tenantB = await setupTenant("campaign-guest-b");
    await createCampaignAndCoupon(tenantB.tenantId, { ruleType: "percentage_off", ruleConfig: { percentage: 10 }, code: "CROSSTENANT" });

    const { orderId: orderInB } = await placeStaffOrder(tenantB.owner, tenantB.counterTableId, [{ productId: tenantB.productAId, quantity: 1 }]);

    const guestA = await bootstrapGuestForTable(tenantA.counterTableId);
    const { error } = await guestA.client.rpc("apply_coupon_to_order", { p_order_id: orderInB, p_code: "CROSSTENANT" });
    expect(error).not.toBeNull();
  });
});
