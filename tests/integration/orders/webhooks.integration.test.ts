import { afterAll, describe, expect, it } from "vitest";

import { createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

// "Webhook teslimatı" describe'undaki iki test GERÇEK bir HTTP POST'a ihtiyaç
// duyar: pg_net asenkron olduğu için gerçek bir cevap olmadan retry mantığı
// doğrulanamaz (bkz. 0065 migration yorumu).
//
// Hedef 2026-08-04'e kadar dış bir servisti (httpbin.org) ve o servis
// düştüğünde test ürün hatası yokken kırılıyordu (ölçüldü: 15 sn'de HTTP
// 000). Artık hedef, aynı Docker ağındaki bir edge function:
// supabase/functions/webhook-test-sink.
//
// NEDEN host.docker.internal DEĞİL: isteği pg_net atıyor, yani POSTGRES
// CONTAINER'ının içinden çıkıyor. `host.docker.internal` yalnızca Docker
// Desktop'ta çözülür; CI ubuntu-latest üzerinde koşuyor (.github/workflows/
// ci.yml) ve orada çözülmez. Kong servis adı iki ortamda da çalışır.
const WEBHOOK_SINK = "http://kong:8000/functions/v1/webhook-test-sink";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function setupTenant(prefix: string, apiEnabled = true) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();
  await service.from("tenant_modules").insert([
    { tenant_id: tenant.tenantId, module_key: "api_access", is_enabled: apiEnabled },
    { tenant_id: tenant.tenantId, module_key: "pos_cash", is_enabled: true },
  ]);
  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, owner };
}

async function registerWebhook(tenantId: string, url: string, eventTypes: string[]) {
  const service = serviceRoleClient();
  const { data } = await service
    .from("webhooks")
    .insert({ tenant_id: tenantId, url, secret: "test-secret", event_types: eventTypes })
    .select("id")
    .single();
  return data!.id as string;
}

describe("Webhook kaydı: olay yakalama (Faz 10 Adım 1, S42)", () => {
  it("submit_staff_order ile sipariş oluşturunca order.created teslimatı otomatik kuyruğa girer", async () => {
    const { tenantId, branchId, owner } = await setupTenant("webhook-order-created");
    await registerWebhook(tenantId, "https://example.invalid/webhook", ["order.created"]);

    const service = serviceRoleClient();
    const categoryId = crypto.randomUUID();
    const productId = crypto.randomUUID();
    await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
    await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 1000, display_order: 0 });
    const { data: counterTable } = await service.from("tables").select("id").eq("tenant_id", tenantId).eq("branch_id", branchId).eq("is_counter", true).single();

    const { error } = await owner.rpc("submit_staff_order", { p_table_id: counterTable!.id, p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }] });
    expect(error).toBeNull();

    const { data: deliveries } = await service.from("webhook_deliveries").select("event_type, status, payload").eq("tenant_id", tenantId);
    expect(deliveries).toHaveLength(1);
    expect(deliveries![0].event_type).toBe("order.created");
    expect(deliveries![0].status).toBe("pending");
  });

  it("advance_order_status ile durum değişince order.status_changed teslimatı kuyruğa girer", async () => {
    const { tenantId, branchId, owner } = await setupTenant("webhook-status-changed");
    await registerWebhook(tenantId, "https://example.invalid/webhook", ["order.status_changed"]);

    const service = serviceRoleClient();
    const categoryId = crypto.randomUUID();
    const productId = crypto.randomUUID();
    await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
    await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 1000, display_order: 0 });
    const { data: counterTable } = await service.from("tables").select("id").eq("tenant_id", tenantId).eq("branch_id", branchId).eq("is_counter", true).single();
    const { data: order } = await owner.rpc("submit_staff_order", { p_table_id: counterTable!.id, p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }] });

    await owner.rpc("advance_order_status", { p_order_id: order![0].order_id, p_to_status: "preparing" });

    const { data: deliveries } = await service
      .from("webhook_deliveries")
      .select("event_type, payload")
      .eq("tenant_id", tenantId)
      .eq("event_type", "order.status_changed");
    expect(deliveries).toHaveLength(1);
    expect(deliveries![0].payload).toMatchObject({ status: "preparing", previous_status: "approved" });
  });

  it("webhook başka bir olay tipine kayıtlıysa alakasız olay onu tetiklemez", async () => {
    const { tenantId, branchId, owner } = await setupTenant("webhook-event-filter");
    await registerWebhook(tenantId, "https://example.invalid/webhook", ["order.status_changed"]);

    const service = serviceRoleClient();
    const categoryId = crypto.randomUUID();
    const productId = crypto.randomUUID();
    await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
    await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 1000, display_order: 0 });
    const { data: counterTable } = await service.from("tables").select("id").eq("tenant_id", tenantId).eq("branch_id", branchId).eq("is_counter", true).single();
    await owner.rpc("submit_staff_order", { p_table_id: counterTable!.id, p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }] });

    const { data: deliveries } = await service.from("webhook_deliveries").select("id").eq("tenant_id", tenantId).eq("event_type", "order.created");
    expect(deliveries).toHaveLength(0);
  });

  it("api_access modülü kapalıyken hiçbir teslimat kuyruğa girmez", async () => {
    const { tenantId, branchId, owner } = await setupTenant("webhook-module-disabled", false);
    await registerWebhook(tenantId, "https://example.invalid/webhook", ["order.created"]);

    const service = serviceRoleClient();
    const categoryId = crypto.randomUUID();
    const productId = crypto.randomUUID();
    await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
    await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 1000, display_order: 0 });
    const { data: counterTable } = await service.from("tables").select("id").eq("tenant_id", tenantId).eq("branch_id", branchId).eq("is_counter", true).single();
    await owner.rpc("submit_staff_order", { p_table_id: counterTable!.id, p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }] });

    const { data: deliveries } = await service.from("webhook_deliveries").select("id").eq("tenant_id", tenantId);
    expect(deliveries).toHaveLength(0);
  });

  it("pasif (is_active=false) webhook yeni olay yakalamaz", async () => {
    const { tenantId, branchId, owner } = await setupTenant("webhook-inactive");
    const webhookId = await registerWebhook(tenantId, "https://example.invalid/webhook", ["order.created"]);
    const service = serviceRoleClient();
    await service.from("webhooks").update({ is_active: false }).eq("id", webhookId);

    const categoryId = crypto.randomUUID();
    const productId = crypto.randomUUID();
    await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
    await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 1000, display_order: 0 });
    const { data: counterTable } = await service.from("tables").select("id").eq("tenant_id", tenantId).eq("branch_id", branchId).eq("is_counter", true).single();
    await owner.rpc("submit_staff_order", { p_table_id: counterTable!.id, p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }] });

    const { data: deliveries } = await service.from("webhook_deliveries").select("id").eq("tenant_id", tenantId);
    expect(deliveries).toHaveLength(0);
  });
});

// pg_net gerçek bir dış HTTP isteği attığı için yanıt süresi ağ koşullarına
// göre değişir — sabit bir bekleme yerine, yanıt gelene kadar (veya deneme
// hakkı bitene kadar) reconcile_webhook_deliveries'i tekrar tekrar çağırıp
// polling yaparız (bkz. TESTING.md §7 — sabit 2sn bekleme geçmişte uzak uç
// gecikme varyansına karşı kırılgan çıktı).
async function pollUntilSettled(
  service: ReturnType<typeof serviceRoleClient>,
  tenantId: string,
  isSettled: (status: string) => boolean,
  maxAttempts = 8,
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await service.rpc("reconcile_webhook_deliveries");
    const { data } = await service.from("webhook_deliveries").select("*").eq("tenant_id", tenantId).single();
    if (data && isSettled(data.status)) {
      return data;
    }
  }
  const { data } = await service.from("webhook_deliveries").select("*").eq("tenant_id", tenantId).single();
  return data;
}

describe("Webhook teslimatı: imzalama + retry (Faz 10 Adım 1, S42)", () => {
  it("dispatch_webhook_deliveries HMAC imzalı gerçek bir HTTP POST atar, 2xx cevap 'delivered' olur", async () => {
    const { tenantId } = await setupTenant("webhook-dispatch-success");
    const service = serviceRoleClient();
    await registerWebhook(tenantId, WEBHOOK_SINK, ["order.created"]);
    await service.rpc("enqueue_webhook_event", { p_tenant_id: tenantId, p_event_type: "order.created", p_payload: { order_id: "x" } });

    await service.rpc("dispatch_webhook_deliveries");
    const { data: afterDispatch } = await service.from("webhook_deliveries").select("status, pg_net_request_id").eq("tenant_id", tenantId).single();
    expect(afterDispatch?.status).toBe("sent");
    expect(afterDispatch?.pg_net_request_id).not.toBeNull();

    const afterReconcile = await pollUntilSettled(service, tenantId, (status) => status === "delivered");
    expect(afterReconcile?.status).toBe("delivered");
    expect(afterReconcile?.delivered_at).not.toBeNull();
  }, 30_000);

  it("başarısız (5xx) teslimat üstel geri çekilmeyle 'pending'e döner, denemeleri artırır", async () => {
    const { tenantId } = await setupTenant("webhook-dispatch-retry");
    const service = serviceRoleClient();
    await registerWebhook(tenantId, `${WEBHOOK_SINK}?status=500`, ["order.created"]);
    await service.rpc("enqueue_webhook_event", { p_tenant_id: tenantId, p_event_type: "order.created", p_payload: { order_id: "x" } });

    await service.rpc("dispatch_webhook_deliveries");
    const data = await pollUntilSettled(service, tenantId, (status) => status === "pending");

    expect(data?.status).toBe("pending");
    expect(data?.attempt_count).toBe(1);
    expect(new Date(data!.next_retry_at).getTime()).toBeGreaterThan(Date.now());
  }, 30_000);
});
