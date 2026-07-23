import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { tenantUrl } from "../helpers/tenant";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

async function createIsolatedTenantWithTwoCategories() {
  const service = serviceClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const subdomain = `test-kdsstation-${suffix}`;
  const email = `owner-kdsstation-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "KDS Station Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert({ tenant_id: tenantId, module_key: "pos_cash", is_enabled: true });
  await service.from("tenant_locales").insert({ tenant_id: tenantId, locale: "tr", is_default: true });

  const grillCategoryId = crypto.randomUUID();
  const saladCategoryId = crypto.randomUUID();
  const grillProductId = crypto.randomUUID();
  const saladProductId = crypto.randomUUID();
  await service.from("menu_categories").insert([
    { id: grillCategoryId, tenant_id: tenantId, layout: "grid", display_order: 0 },
    { id: saladCategoryId, tenant_id: tenantId, layout: "grid", display_order: 1 },
  ]);
  await service.from("content_translations").insert([
    { tenant_id: tenantId, entity_type: "menu_category", entity_id: grillCategoryId, locale: "tr", field: "name", value: "Izgara" },
    { tenant_id: tenantId, entity_type: "menu_category", entity_id: saladCategoryId, locale: "tr", field: "name", value: "Salata" },
  ]);
  await service.from("products").insert([
    { id: grillProductId, tenant_id: tenantId, category_id: grillCategoryId, track_mode: "simple", base_price_minor: 5000, display_order: 0 },
    { id: saladProductId, tenant_id: tenantId, category_id: saladCategoryId, track_mode: "simple", base_price_minor: 3000, display_order: 0 },
  ]);
  await service.from("content_translations").insert([
    { tenant_id: tenantId, entity_type: "product", entity_id: grillProductId, locale: "tr", field: "name", value: "Izgara Köfte" },
    { tenant_id: tenantId, entity_type: "product", entity_id: grillProductId, locale: "en", field: "name", value: "Grilled Meatball" },
    { tenant_id: tenantId, entity_type: "product", entity_id: saladProductId, locale: "tr", field: "name", value: "Mevsim Salata" },
    { tenant_id: tenantId, entity_type: "product", entity_id: saladProductId, locale: "en", field: "name", value: "Seasonal Salad" },
  ]);

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  return { tenantId, subdomain, email, grillCategoryId };
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

test("S28: kategoriye istasyon atanır, KDS'de istasyon seçilince yalnızca o istasyonun kalemleri görünür", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email, grillCategoryId } = await createIsolatedTenantWithTwoCategories();
  try {
    await loginAsIsolatedOwner(page, baseURL!, subdomain, email);

    // Kategori düzenleyicisine "İstasyon" alanı eklendi — Izgara kategorisine atanır.
    await page.goto(tenantUrl(baseURL!, subdomain, `/admin/menu/${grillCategoryId}`));
    await page.getByLabel("İstasyon").fill("izgara");
    await page.getByRole("button", { name: "Kaydet" }).click();
    // redirectTo aynı sayfa olduğu için URL değişmiyor — toHaveURL bu yüzden
    // mutasyonun bitişini beklemeden trivially geçer. networkidle, server
    // action'ın (ve router.refresh()'in) gerçekten tamamlandığından emin olur.
    await page.waitForLoadState("networkidle");

    // Tezgâhtan her iki kategoriden birer ürün içeren bir sipariş verilir.
    await page.goto(tenantUrl(baseURL!, subdomain, "/cashier/order"));
    await page.getByLabel("Masa Seç").click();
    await page.getByRole("option", { name: /Tezgâh/ }).click();
    for (const name of ["Izgara Köfte", "Mevsim Salata"]) {
      const row = page.getByText(name, { exact: true }).locator("../..");
      await row.getByRole("button", { name: "Siparişe Ekle" }).click();
    }
    await page.getByRole("button", { name: "Siparişi Gönder" }).click();
    await expect(page.getByText("Sipariş gönderildi.")).toBeVisible();

    // Filtresiz KDS: her iki kalem de görünür.
    await page.goto(tenantUrl(baseURL!, subdomain, "/kitchen"));
    await expect(page.getByText("Izgara Köfte")).toBeVisible();
    await expect(page.getByText("Mevsim Salata")).toBeVisible();

    // "izgara" istasyonu seçilince yalnızca o istasyonun kalemi görünür.
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "izgara" }).click();
    await expect(page).toHaveURL(/[?&]station=izgara/);
    await expect(page.getByText("Izgara Köfte")).toBeVisible();
    await expect(page.getByText("Mevsim Salata")).not.toBeVisible();

    // "Tüm İstasyonlar"a dönünce davranış eskisi gibi tam listeye döner.
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Tüm İstasyonlar" }).click();
    await expect(page).toHaveURL(/\/kitchen$/);
    await expect(page.getByText("Mevsim Salata")).toBeVisible();
  } finally {
    await deleteTenant(tenantId);
  }
});
