import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

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
  const subdomain = `test-stock-${suffix}`;
  const email = `owner-stock-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Stock Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert({ tenant_id: tenantId, module_key: "inventory", is_enabled: true });

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

test("S35/S36: tedarikçi + alım girişi + fire/sayım, kritik stok özeti", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenant();
  try {
    await loginAsIsolatedOwner(page, baseURL!, subdomain, email);

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/suppliers"));
    await page.getByLabel("Ad", { exact: true }).fill("Yerel Tedarikçi");
    await page.getByRole("button", { name: "+ Tedarikçi Ekle" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Yerel Tedarikçi")).toBeVisible();

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/ingredients"));
    await page.getByLabel("Ad", { exact: true }).fill("Un");
    await page.getByLabel("Kritik Seviye").fill("500");
    await page.getByRole("button", { name: "+ Malzeme Ekle" }).click();
    await page.waitForLoadState("networkidle");

    const row = page.getByText("Un", { exact: true }).locator("../../..");
    await row.getByRole("button", { name: "Alım Gir" }).click();
    const purchaseForm = row.locator("form");
    await purchaseForm.getByLabel("Miktar").fill("1000");
    await purchaseForm.getByLabel("Birim Maliyet (₺)").fill("2.50");
    await purchaseForm.getByRole("combobox", { name: "Tedarikçi" }).click();
    await page.getByRole("option", { name: "Yerel Tedarikçi" }).click();
    await purchaseForm.getByRole("button", { name: "Kaydet", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await expect(row.getByText("Mevcut Stok: 1000")).toBeVisible();

    await row.getByRole("button", { name: "Fire Kaydet" }).click();
    const wasteForm = row.locator("form");
    await wasteForm.getByLabel("Miktar").fill("50");
    await wasteForm.getByRole("button", { name: "Kaydet", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await expect(row.getByText("Mevcut Stok: 950")).toBeVisible();

    await row.getByRole("button", { name: "Sayım Gir" }).click();
    const countForm = row.locator("form");
    await countForm.getByLabel("Sayılan Miktar").fill("400");
    await countForm.getByRole("button", { name: "Kaydet", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("1 malzeme kritik seviyenin altında: Un")).toBeVisible();

    const service = serviceClient();
    const { data: ingredient } = await service.from("ingredients").select("current_stock, avg_cost_minor_per_unit").eq("tenant_id", tenantId).eq("name", "Un").single();
    expect(ingredient?.current_stock).toBe(400);
    expect(ingredient?.avg_cost_minor_per_unit).toBe(250);

    const { data: movements } = await service.from("stock_movements").select("type").eq("tenant_id", tenantId).order("created_at");
    expect(movements?.map((m) => m.type)).toEqual(["purchase", "waste", "count_adjustment"]);
  } finally {
    await deleteTenant(tenantId);
  }
});
