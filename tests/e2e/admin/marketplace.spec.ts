import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { tenantUrl } from "../helpers/tenant";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

async function createIsolatedTenant() {
  const service = serviceClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const subdomain = `test-marketplace-${suffix}`;
  const email = `owner-marketplace-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Marketplace Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert([
    { tenant_id: tenantId, module_key: "marketplace", is_enabled: true },
    { tenant_id: tenantId, module_key: "api_access", is_enabled: true },
  ]);

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 1000, stock_quantity: 10, display_order: 0 });
  await service.from("content_translations").insert({ tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "tr", field: "name", value: "Test Ürünü" });

  return { tenantId, subdomain, email, productId };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("S43: admin SKU eşlemesi kurar, pazar yeri gerçek HTTP isteğiyle sipariş oluşturur (idempotent)", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenant();
  try {
    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin$/);

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/api-keys"));
    await page.getByLabel("Anahtar Adı").fill("Pazar Yeri Entegrasyonu");
    await page.getByRole("button", { name: "+ Anahtar Oluştur" }).click();
    await page.waitForLoadState("networkidle");
    const rawKey = await page.locator("code").textContent();
    expect(rawKey).toMatch(/^rkys_live_/);

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/marketplace"));
    await page.getByLabel("Pazar Yeri Kodu (SKU)").fill("YS-1001");
    await page.getByRole("combobox", { name: "Ürün" }).click();
    await page.getByRole("option", { name: "Test Ürünü" }).click();
    await page.getByRole("button", { name: "+ Eşleme Ekle" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("YS-1001")).toBeVisible();

    const orderPayload = {
      externalOrderId: "ys-order-1",
      items: [{ externalSku: "YS-1001", quantity: 2, unitPriceMinor: 1100, name: "Test Ürünü" }],
    };
    const response = await page.request.post(`${baseURL}/api/integrations/marketplace/mock/orders`, {
      headers: { Authorization: `Bearer ${rawKey}` },
      data: orderPayload,
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.isDuplicate).toBe(false);

    const service = serviceClient();
    const { data: order } = await service
      .from("orders")
      .select("channel, status, subtotal_minor")
      .eq("id", body.orderId)
      .single();
    expect(order?.channel).toBe("marketplace");
    expect(order?.status).toBe("approved");
    expect(order?.subtotal_minor).toBe(2200);

    const duplicateResponse = await page.request.post(`${baseURL}/api/integrations/marketplace/mock/orders`, {
      headers: { Authorization: `Bearer ${rawKey}` },
      data: orderPayload,
    });
    expect(duplicateResponse.status()).toBe(200);
    const duplicateBody = await duplicateResponse.json();
    expect(duplicateBody.isDuplicate).toBe(true);
    expect(duplicateBody.orderId).toBe(body.orderId);

    const noAuthResponse = await page.request.post(`${baseURL}/api/integrations/marketplace/mock/orders`, {
      data: orderPayload,
    });
    expect(noAuthResponse.status()).toBe(401);
  } finally {
    await deleteTenant(tenantId);
  }
});
