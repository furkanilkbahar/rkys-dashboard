import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { tenantUrl } from "../helpers/tenant";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

async function createIsolatedTenantWithProduct() {
  const service = serviceClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const subdomain = `test-recipe-${suffix}`;
  const email = `owner-recipe-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Recipe Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert([
    { tenant_id: tenantId, module_key: "pos_cash", is_enabled: true },
    { tenant_id: tenantId, module_key: "inventory", is_enabled: true },
    { tenant_id: tenantId, module_key: "recipes", is_enabled: true },
  ]);
  await service.from("tenant_locales").insert({ tenant_id: tenantId, locale: "tr", is_default: true });

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 5000, display_order: 0 });
  await service.from("content_translations").insert([
    { tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "tr", field: "name", value: "Latte" },
    { tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "en", field: "name", value: "Latte" },
  ]);

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  return { tenantId, categoryId, productId, subdomain, email };
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

test("S34: admin malzeme+reçete tanımlar, siparişte reçeteden stok otomatik düşer", async ({ page, baseURL }) => {
  const { tenantId, categoryId, productId, subdomain, email } = await createIsolatedTenantWithProduct();
  try {
    await loginAsIsolatedOwner(page, baseURL!, subdomain, email);

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/ingredients"));
    await page.getByLabel("Ad", { exact: true }).fill("Süt");
    await page.getByRole("combobox", { name: "Birim" }).click();
    await page.getByRole("option", { name: "ml", exact: true }).click();
    await page.getByLabel("Kritik Seviye").fill("100");
    await page.getByRole("button", { name: "+ Malzeme Ekle" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Süt", { exact: true })).toBeVisible();

    const service = serviceClient();
    await service.from("ingredients").update({ current_stock: 1000 }).eq("tenant_id", tenantId).eq("name", "Süt");
    const { data: ingredient } = await service.from("ingredients").select("id").eq("tenant_id", tenantId).eq("name", "Süt").single();

    await page.goto(tenantUrl(baseURL!, subdomain, `/admin/menu/${categoryId}/products/${productId}`));
    await page.getByRole("combobox", { name: "Stok Takip Modu" }).click();
    await page.getByRole("option", { name: "Reçeteden düş" }).click();
    await page.getByRole("button", { name: "Kaydet" }).click();
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Reçeteyi Düzenle →" }).click();
    await page.getByRole("button", { name: "+ Malzeme Ekle" }).click();
    await page.getByRole("combobox", { name: "Malzeme" }).click();
    await page.getByRole("option", { name: /Süt/ }).click();
    await page.getByPlaceholder("Miktar").fill("200");
    await page.getByRole("button", { name: "Reçeteyi Kaydet" }).click();
    await expect(page.getByText("Kaydedildi.")).toBeVisible();

    await page.goto(tenantUrl(baseURL!, subdomain, "/cashier/order"));
    await page.getByLabel("Masa Seç").click();
    await page.getByRole("option", { name: /Tezgâh/ }).click();
    const row = page.getByText("Latte", { exact: true }).locator("../..");
    await row.getByRole("button", { name: "Siparişe Ekle" }).click();
    await page.getByRole("button", { name: "Siparişi Gönder" }).click();
    await expect(page.getByText("Sipariş gönderildi.")).toBeVisible();
    await page.waitForLoadState("networkidle");

    const { data: updatedIngredient } = await service.from("ingredients").select("current_stock").eq("id", ingredient!.id).single();
    expect(updatedIngredient?.current_stock).toBe(800); // 1000 - 200

    const { data: movements } = await service.from("stock_movements").select("type, quantity_delta").eq("ingredient_id", ingredient!.id);
    expect(movements).toHaveLength(1);
    expect(movements![0]).toEqual({ type: "sale_deduction", quantity_delta: -200 });
  } finally {
    await deleteTenant(tenantId);
  }
});
