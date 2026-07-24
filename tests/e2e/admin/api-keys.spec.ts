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
  const subdomain = `test-apikeys-${suffix}`;
  const email = `owner-apikeys-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "API Keys Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert([
    { tenant_id: tenantId, module_key: "api_access", is_enabled: true },
    { tenant_id: tenantId, module_key: "pos_cash", is_enabled: true },
  ]);

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 3500, display_order: 0 });
  const { data: counterTable } = await service.from("tables").select("id").eq("tenant_id", tenantId).eq("is_counter", true).single();

  const owner = createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  );
  await owner.auth.signInWithPassword({ email, password: "password123" });
  await owner.rpc("submit_staff_order", { p_table_id: counterTable!.id, p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }] });

  return { tenantId, subdomain, email };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("S41: admin API anahtarı oluşturur, gerçek anahtarla /api/v1/orders yalnızca kendi siparişlerini döner", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenant();
  try {
    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin$/);

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/api-keys"));
    await page.getByLabel("Anahtar Adı").fill("Test Entegrasyonu");
    await page.getByRole("button", { name: "+ Anahtar Oluştur" }).click();
    await page.waitForLoadState("networkidle");

    const rawKey = await page.locator("code").textContent();
    expect(rawKey).toMatch(/^rkys_live_/);

    const response = await page.request.get(`${baseURL}/api/v1/orders`, { headers: { Authorization: `Bearer ${rawKey}` } });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].channel).toBe("dine_in");
    expect(body.data[0].subtotalMinor).toBe(3500);

    const noAuthResponse = await page.request.get(`${baseURL}/api/v1/orders`);
    expect(noAuthResponse.status()).toBe(401);

    await page.getByRole("button", { name: "İptal Et" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("İptal Edildi")).toBeVisible({ timeout: 10_000 });
    const revokedResponse = await page.request.get(`${baseURL}/api/v1/orders`, { headers: { Authorization: `Bearer ${rawKey}` } });
    expect(revokedResponse.status()).toBe(401);
  } finally {
    await deleteTenant(tenantId);
  }
});
