import { afterAll, describe, expect, it } from "vitest";

import { SEED, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

// Sabit auth.users id'leri (supabase/seed/seed.sql) — owner@acme.test/
// manager@acme.test/owner@beta.test için.
const ACME_OWNER_ID = "00000000-0000-4000-8000-0000000000a1";
const ACME_MANAGER_ID = "00000000-0000-4000-8000-0000000000a2";
const BETA_OWNER_ID = "00000000-0000-4000-8000-0000000000b1";

const cleanupKeys: { userId: string; widgetKey: string }[] = [];

afterAll(async () => {
  const service = serviceRoleClient();
  for (const { userId, widgetKey } of cleanupKeys) {
    await service.from("dashboard_widgets").delete().eq("user_id", userId).eq("widget_key", widgetKey);
  }
});

describe("dashboard_widgets RLS (Faz 5 Adım 2, S22)", () => {
  it("kullanıcı kendi widget düzenini kaydedip okuyabilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    cleanupKeys.push({ userId: ACME_OWNER_ID, widgetKey: "revenue_today" });

    const { error: upsertError } = await owner
      .from("dashboard_widgets")
      .upsert({ tenant_id: SEED.acme.tenantId, user_id: ACME_OWNER_ID, widget_key: "revenue_today", position: 3, is_visible: false });
    expect(upsertError).toBeNull();

    const { data, error } = await owner
      .from("dashboard_widgets")
      .select("position, is_visible")
      .eq("user_id", ACME_OWNER_ID)
      .eq("widget_key", "revenue_today")
      .single();
    expect(error).toBeNull();
    expect(data?.position).toBe(3);
    expect(data?.is_visible).toBe(false);
  });

  it("aynı tenant'ta farklı personelin widget düzeni birbirini etkilemez ve birbirine görünmez", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const manager = await signInAsSeededOwner(SEED.acme.managerEmail);
    cleanupKeys.push({ userId: ACME_OWNER_ID, widgetKey: "order_count_today" }, { userId: ACME_MANAGER_ID, widgetKey: "order_count_today" });

    await owner
      .from("dashboard_widgets")
      .upsert({ tenant_id: SEED.acme.tenantId, user_id: ACME_OWNER_ID, widget_key: "order_count_today", position: 0, is_visible: true });
    await manager
      .from("dashboard_widgets")
      .upsert({ tenant_id: SEED.acme.tenantId, user_id: ACME_MANAGER_ID, widget_key: "order_count_today", position: 4, is_visible: true });

    const { data: ownerOwn } = await owner
      .from("dashboard_widgets")
      .select("position")
      .eq("user_id", ACME_OWNER_ID)
      .eq("widget_key", "order_count_today")
      .single();
    expect(ownerOwn?.position).toBe(0);

    // Owner, manager'ın satırını user_id ile filtreleyerek sorgulasa bile RLS
    // (user_id = auth.uid()) nedeniyle hiçbir satır görmez.
    const { data: ownerSeesManager } = await owner
      .from("dashboard_widgets")
      .select("position")
      .eq("user_id", ACME_MANAGER_ID)
      .eq("widget_key", "order_count_today");
    expect(ownerSeesManager).toHaveLength(0);

    const { data: managerOwn } = await manager
      .from("dashboard_widgets")
      .select("position")
      .eq("user_id", ACME_MANAGER_ID)
      .eq("widget_key", "order_count_today")
      .single();
    expect(managerOwn?.position).toBe(4);
  });

  it("RLS: başka tenant'ın personeli dashboard_widgets satırını okuyamaz ve kendi tenant'ı dışına yazamaz", async () => {
    const acmeOwner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    cleanupKeys.push({ userId: ACME_OWNER_ID, widgetKey: "top_products" });
    await acmeOwner
      .from("dashboard_widgets")
      .upsert({ tenant_id: SEED.acme.tenantId, user_id: ACME_OWNER_ID, widget_key: "top_products", position: 1, is_visible: true });

    const betaOwner = await signInAsSeededOwner(SEED.beta.ownerEmail);
    const { data: crossTenantRead } = await betaOwner
      .from("dashboard_widgets")
      .select("position")
      .eq("user_id", ACME_OWNER_ID)
      .eq("widget_key", "top_products");
    expect(crossTenantRead).toHaveLength(0);

    const { error: crossTenantWriteError } = await betaOwner
      .from("dashboard_widgets")
      .upsert({ tenant_id: SEED.acme.tenantId, user_id: BETA_OWNER_ID, widget_key: "branch_comparison", position: 0, is_visible: true });
    expect(crossTenantWriteError).not.toBeNull();
  });
});
