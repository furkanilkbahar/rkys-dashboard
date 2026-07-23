import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { tenantUrl } from "../helpers/tenant";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

// Diğer kasa E2E'leriyle aynı gerekçeyle (paylaşılan tezgâh yarışı) kendi
// tek kullanımlık tenant'ını + ürününü kurar.
async function createIsolatedTenantWithProduct() {
  const service = serviceClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const subdomain = `test-partialrefund-${suffix}`;
  const email = `owner-partialrefund-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId,
    slug: subdomain,
    name: "Partial Refund Test",
    status: "active",
    timezone: "Europe/Istanbul",
    currency: "TRY",
    onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert({ tenant_id: tenantId, module_key: "pos_cash", is_enabled: true });
  await service.from("tenant_locales").insert({ tenant_id: tenantId, locale: "tr", is_default: true });

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 10000, display_order: 0 });
  await service.from("content_translations").insert([
    { tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "tr", field: "name", value: "Test Ürünü" },
    { tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "en", field: "name", value: "Test Product" },
  ]);

  // "Son Ödemeler"/İade Et bölümü yalnızca refund kategorili en az bir
  // reason_code varsa render edilir (settings-manager.tsx, refundReasons).
  const refundReasonId = crypto.randomUUID();
  await service.from("reason_codes").insert({ id: refundReasonId, tenant_id: tenantId, category: "refund", key: "test_refund", display_order: 0 });
  await service.from("content_translations").insert({
    tenant_id: tenantId,
    entity_type: "reason_code",
    entity_id: refundReasonId,
    locale: "tr",
    field: "name",
    value: "Test İade Sebebi",
  });

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  return { tenantId, subdomain, email };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

async function loginAsIsolatedOwner(page: Page, baseURL: string, subdomain: string, email: string) {
  await page.goto(tenantUrl(baseURL, subdomain, "/admin/login"));
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/admin$/);
}

test("S26: kasa — kısmi iade, ödeme 'kısmen iade edildi' olur; ikinci kısmi iade tam iadeye tamamlar", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenantWithProduct();
  try {
    await loginAsIsolatedOwner(page, baseURL!, subdomain, email);

    await page.goto(tenantUrl(baseURL!, subdomain, "/cashier/order"));
    await page.getByLabel("Masa Seç").click();
    await page.getByRole("option", { name: /Tezgâh/ }).click();
    const row = page.getByText("Test Ürünü", { exact: true }).locator("../..");
    await row.getByRole("button", { name: "Siparişe Ekle" }).click();
    await page.getByRole("button", { name: "Siparişi Gönder" }).click();
    await expect(page.getByText("Sipariş gönderildi.")).toBeVisible();

    await page.goto(tenantUrl(baseURL!, subdomain, "/cashier/pay"));
    await page.getByRole("button", { name: /Tezgâh/ }).click();
    await page.getByRole("button", { name: "Ödemeye Başla" }).click();
    await page.getByRole("button", { name: "Öde", exact: true }).click();
    await expect(page.getByText("Tüm paylar ödendi, hesap kapandı.")).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "İade Et" }).click();
    await expect(page.getByText("Kalan iade edilebilir tutar: ₺100,00")).toBeVisible();
    await page.getByLabel("Tutar").fill("40");
    await page.getByRole("button", { name: "İadeyi Onayla" }).click();
    await page.waitForLoadState("networkidle");

    await page.reload();
    await expect(page.getByText("Kısmen iade edildi")).toBeVisible();

    await page.getByRole("button", { name: "İade Et" }).click();
    await expect(page.getByText("Kalan iade edilebilir tutar: ₺60,00")).toBeVisible();
    await page.getByLabel("Tutar").fill("60");
    await page.getByRole("button", { name: "İadeyi Onayla" }).click();
    await page.waitForLoadState("networkidle");

    await page.reload();
    await expect(page.getByText("İade edildi", { exact: true })).toBeVisible();

    const service = serviceClient();
    const { data: refunds } = await service.from("refunds").select("amount_minor").eq("tenant_id", tenantId);
    expect(refunds).toHaveLength(2);
    expect(refunds!.reduce((sum, r) => sum + r.amount_minor, 0)).toBe(10000);
  } finally {
    await deleteTenant(tenantId);
  }
});
