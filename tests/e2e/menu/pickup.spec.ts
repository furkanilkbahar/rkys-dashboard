import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

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
  const subdomain = `test-pickup-${suffix}`;
  const email = `owner-pickup-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Pickup Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert({ tenant_id: tenantId, module_key: "pickup", is_enabled: true });
  await service.from("tenant_locales").insert({ tenant_id: tenantId, locale: "tr", is_default: true });

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 4000, display_order: 0 });
  await service.from("content_translations").insert([
    { tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "tr", field: "name", value: "Simit" },
    { tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "en", field: "name", value: "Simit" },
  ]);

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  return { tenantId, subdomain, email };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("S38: misafir Gel-Al siparişi verir, teslim kodu görür, mutfak hazır olarak işaretleyince bildirim alır", async ({ browser, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenantWithProduct();
  try {
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await staffPage.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await staffPage.getByLabel("E-posta").fill(email);
    await staffPage.getByLabel("Şifre").fill("password123");
    await staffPage.getByRole("button", { name: "Giriş yap" }).click();
    await staffPage.waitForURL(/\/admin$/);

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(tenantUrl(baseURL!, subdomain, "/paket/baslat"));
    await expect(guestPage).toHaveURL(/\/paket$/);
    await expect(guestPage.getByText(/Teslim Kodunuz: [A-Z0-9]{6}/)).toBeVisible();

    const productCard = guestPage.locator('[data-slot="card"]').filter({ hasText: "Simit" });
    await productCard.getByRole("button", { name: "Sepete ekle" }).click();
    await guestPage.getByRole("button", { name: "Siparişi Gönder" }).click();
    await expect(guestPage.getByText("Siparişiniz alındı.")).toBeVisible({ timeout: 15_000 });

    await staffPage.goto(tenantUrl(baseURL!, subdomain, "/kitchen"));
    const kdsCard = staffPage.locator('[data-slot="card"]').filter({ hasText: /Gel-Al #/ }).last();
    await expect(kdsCard).toBeVisible({ timeout: 15_000 });
    await kdsCard.getByRole("button", { name: "Hazırlamaya Başla" }).click();
    await expect(kdsCard.getByRole("button", { name: "Hazır", exact: true })).toBeVisible({ timeout: 15_000 });
    await kdsCard.getByRole("button", { name: "Hazır", exact: true }).click();

    await expect(guestPage.getByText("Siparişiniz hazır!")).toBeVisible({ timeout: 15_000 });

    const service = serviceClient();
    const { data: order } = await service.from("orders").select("channel").eq("tenant_id", tenantId).single();
    expect(order?.channel).toBe("pickup");

    await staffContext.close();
    await guestContext.close();
  } finally {
    await deleteTenant(tenantId);
  }
});
