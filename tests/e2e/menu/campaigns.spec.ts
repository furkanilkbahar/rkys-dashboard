import { createHash } from "crypto";

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
  const tableId = crypto.randomUUID();
  const subdomain = `test-campaigns-${suffix}`;
  const email = `owner-campaigns-${suffix}@test-throwaway.test`;
  const rawToken = `demo-campaigns-${suffix}`;

  await service.from("tenants").insert({
    id: tenantId,
    slug: subdomain,
    name: "Campaigns Test",
    status: "active",
    timezone: "Europe/Istanbul",
    currency: "TRY",
    onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert([
    { tenant_id: tenantId, module_key: "pos_cash", is_enabled: true },
    { tenant_id: tenantId, module_key: "campaigns", is_enabled: true },
  ]);
  await service.from("tenant_locales").insert({ tenant_id: tenantId, locale: "tr", is_default: true });
  await service.from("tables").insert({
    id: tableId,
    tenant_id: tenantId,
    branch_id: branchId,
    label: "Masa 1",
    qr_token_hash: createHash("sha256").update(rawToken).digest("hex"),
  });

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 10000, display_order: 0 });
  await service.from("content_translations").insert([
    { tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "tr", field: "name", value: "Kampanya Ürünü" },
    { tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "en", field: "name", value: "Campaign Product" },
  ]);

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  return { tenantId, subdomain, email, rawToken };
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

test("S27: admin kampanya+kupon oluşturur, misafir sepette kuponu uygular", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email, rawToken } = await createIsolatedTenantWithProduct();
  try {
    await loginAsIsolatedOwner(page, baseURL!, subdomain, email);
    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/campaigns"));

    await page.getByLabel("Ad", { exact: true }).fill("Test Kampanyası");
    await page.getByLabel("Yüzde (%)").fill("20");
    await page.getByRole("button", { name: "+ Kampanya Ekle" }).click();
    await expect(page.getByText("Test Kampanyası").first()).toBeVisible();

    await page.getByLabel("Kod").fill("SAVE20");
    await page.getByRole("button", { name: "+ Kupon Ekle" }).click();
    await expect(page.getByText("SAVE20", { exact: false })).toBeVisible();

    await page.goto(tenantUrl(baseURL!, subdomain, `/masa/t/${rawToken}`));
    await expect(page).toHaveURL(/\/masa$/);

    const productCard = page.locator('[data-slot="card"]').filter({ hasText: "Kampanya Ürünü" });
    await productCard.getByRole("button", { name: "Sepete ekle" }).click();
    await page.getByRole("button", { name: "Siparişi Gönder" }).click();
    await expect(page.getByText("Siparişiniz alındı.")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Oturumum" }).click();
    await expect(page.getByPlaceholder("Kupon Kodu")).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder("Kupon Kodu").fill("SAVE20");
    await page.getByRole("button", { name: "Uygula" }).click();
    await expect(page.getByText("Kupon uygulandı: ₺20,00 indirim")).toBeVisible();

    const service = serviceClient();
    const { data: comps } = await service.from("comps").select("amount_minor").eq("tenant_id", tenantId);
    expect(comps).toHaveLength(1);
    expect(comps![0].amount_minor).toBe(2000);
  } finally {
    await deleteTenant(tenantId);
  }
});
