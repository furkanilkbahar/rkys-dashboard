import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { tenantUrl } from "../helpers/tenant";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

// Paylaşılan "acme" tezgâhı diğer kasa E2E'leri arasında yarışa girebiliyor
// (bkz. comps-refunds.spec.ts'nin bilinen kırılganlığı) — kalem seçimi tam
// olarak hangi kalemlerin var olduğuna bağlı olduğundan bu test kendi tek
// kullanımlık tenant'ını + iki farklı ürününü kurar.
async function createIsolatedTenantWithTwoProducts() {
  const service = serviceClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const subdomain = `test-itemsplit-${suffix}`;
  const email = `owner-itemsplit-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId,
    slug: subdomain,
    name: "Item Split Test",
    status: "active",
    timezone: "Europe/Istanbul",
    currency: "TRY",
    onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert({ tenant_id: tenantId, module_key: "pos_cash", is_enabled: true });
  // submit_staff_order (0016) ürün adı snapshot'ını tenant_locales'in
  // is_default=true satırına göre çözer — bu satır olmadan
  // product_name_snapshot boş kalır.
  await service.from("tenant_locales").insert({ tenant_id: tenantId, locale: "tr", is_default: true });

  const categoryId = crypto.randomUUID();
  const productAId = crypto.randomUUID();
  const productBId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert([
    { id: productAId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 3000, display_order: 0 },
    { id: productBId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 5000, display_order: 1 },
  ]);
  await service.from("content_translations").insert([
    { tenant_id: tenantId, entity_type: "product", entity_id: productAId, locale: "tr", field: "name", value: "Test Ürün A" },
    { tenant_id: tenantId, entity_type: "product", entity_id: productAId, locale: "en", field: "name", value: "Test Product A" },
    { tenant_id: tenantId, entity_type: "product", entity_id: productBId, locale: "tr", field: "name", value: "Test Ürün B" },
    { tenant_id: tenantId, entity_type: "product", entity_id: productBId, locale: "en", field: "name", value: "Test Product B" },
  ]);

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

test("S25: kasa — kalem seçerek ödeme, hesap kalan kalemler ödenene kadar açık kalır", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenantWithTwoProducts();
  try {
    await loginAsIsolatedOwner(page, baseURL!, subdomain, email);

    await page.goto(tenantUrl(baseURL!, subdomain, "/cashier/order"));
    await page.getByLabel("Masa Seç").click();
    await page.getByRole("option", { name: /Tezgâh/ }).click();
    for (const name of ["Test Ürün A", "Test Ürün B"]) {
      const row = page.getByText(name, { exact: true }).locator("../..");
      await row.getByRole("button", { name: "Siparişe Ekle" }).click();
    }
    await page.getByRole("button", { name: "Siparişi Gönder" }).click();
    await expect(page.getByText("Sipariş gönderildi.")).toBeVisible();

    await page.goto(tenantUrl(baseURL!, subdomain, "/cashier/pay"));
    await page.getByRole("button", { name: /Tezgâh/ }).click();
    await page.getByRole("button", { name: "Kalem Seç" }).click();

    await page.getByRole("checkbox", { name: "Test Ürün A" }).check();
    await expect(page.getByText("Seçilen Toplam: ₺30,00")).toBeVisible();

    await page.getByRole("button", { name: "Öde", exact: true }).click();
    await page.waitForLoadState("networkidle");

    // Yalnızca A ödendi — hesap hâlâ listede (B kaldı), sayfa yeniden yüklenince de görünür olmalı.
    await page.reload();
    await expect(page.getByRole("button", { name: /Tezgâh/ })).toBeVisible();

    await page.getByRole("button", { name: /Tezgâh/ }).click();
    await page.getByRole("button", { name: "Kalem Seç" }).click();
    await page.getByRole("checkbox", { name: "Test Ürün B" }).check();
    await expect(page.getByText("Seçilen Toplam: ₺50,00")).toBeVisible();
    await page.getByRole("button", { name: "Öde", exact: true }).click();
    await page.waitForLoadState("networkidle");

    // Hesap tamamen ödendi — artık bakiyesi olan hesap listesinde görünmemeli.
    await page.reload();
    await expect(page.getByText("Bakiyesi olan aktif hesap yok.")).toBeVisible();

    const service = serviceClient();
    const { data: allocations } = await service
      .from("payment_item_allocations")
      .select("id")
      .eq("tenant_id", tenantId);
    expect(allocations).toHaveLength(2);
  } finally {
    await deleteTenant(tenantId);
  }
});
