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
  const subdomain = `test-giftcard-${suffix}`;
  const email = `owner-giftcard-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Gift Card Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert([
    { tenant_id: tenantId, module_key: "pos_cash", is_enabled: true },
    { tenant_id: tenantId, module_key: "gift_cards", is_enabled: true },
  ]);
  await service.from("tenant_locales").insert({ tenant_id: tenantId, locale: "tr", is_default: true });

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 5000, display_order: 0 });
  await service.from("content_translations").insert([
    { tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "tr", field: "name", value: "Gift Card Ürünü" },
    { tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "en", field: "name", value: "Gift Card Product" },
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

test("S32: admin hediye kartı oluşturur, kasa hediye kartıyla ödeme alır", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenantWithProduct();
  try {
    await loginAsIsolatedOwner(page, baseURL!, subdomain, email);

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/gift-cards"));
    await page.getByLabel("Kod").fill("GIFT50");
    await page.getByLabel("İlk Bakiye (₺)").fill("100");
    await page.getByRole("button", { name: "+ Kart Oluştur" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("GIFT50")).toBeVisible();

    await page.goto(tenantUrl(baseURL!, subdomain, "/cashier/order"));
    await page.getByLabel("Masa Seç").click();
    await page.getByRole("option", { name: /Tezgâh/ }).click();
    const row = page.getByText("Gift Card Ürünü", { exact: true }).locator("../..");
    await row.getByRole("button", { name: "Siparişe Ekle" }).click();
    await page.getByRole("button", { name: "Siparişi Gönder" }).click();
    await expect(page.getByText("Sipariş gönderildi.")).toBeVisible();

    await page.goto(tenantUrl(baseURL!, subdomain, "/cashier/pay"));
    await page.getByRole("button", { name: /Tezgâh/ }).click();
    await page.getByRole("combobox", { name: "Ödeme Yöntemi" }).click();
    await page.getByRole("option", { name: "Hediye Kartı" }).click();
    await page.getByLabel("Hediye Kartı Kodu").fill("GIFT50");
    await page.getByRole("button", { name: "Ödemeye Başla" }).click();
    await page.getByRole("button", { name: "Öde", exact: true }).click();
    await expect(page.getByText("Tüm paylar ödendi, hesap kapandı.")).toBeVisible();

    const service = serviceClient();
    const { data: card } = await service.from("gift_cards").select("balance_minor").eq("tenant_id", tenantId).eq("code", "GIFT50").single();
    expect(card?.balance_minor).toBe(10000 - 5000);

    const { data: payments } = await service.from("payments").select("method, amount_minor").eq("tenant_id", tenantId);
    expect(payments).toHaveLength(1);
    expect(payments![0]).toEqual({ method: "gift_card", amount_minor: 5000 });
  } finally {
    await deleteTenant(tenantId);
  }
});
