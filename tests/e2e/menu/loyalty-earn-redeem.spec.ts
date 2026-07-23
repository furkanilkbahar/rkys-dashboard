import { createHash } from "crypto";

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
  const tableId = crypto.randomUUID();
  const subdomain = `test-loyalty2-${suffix}`;
  const email = `owner-loyalty2-${suffix}@test-throwaway.test`;
  const rawToken = `demo-loyalty2-${suffix}`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Loyalty Earn/Redeem Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert([
    { tenant_id: tenantId, module_key: "pos_cash", is_enabled: true },
    { tenant_id: tenantId, module_key: "crm_loyalty", is_enabled: true },
  ]);
  await service.from("tenant_locales").insert({ tenant_id: tenantId, locale: "tr", is_default: true });
  await service.from("tables").insert({
    id: tableId, tenant_id: tenantId, branch_id: branchId, label: "Masa 1",
    qr_token_hash: createHash("sha256").update(rawToken).digest("hex"),
  });

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 10000, display_order: 0 });
  await service.from("content_translations").insert([
    { tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "tr", field: "name", value: "Loyalty Ürünü" },
    { tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "en", field: "name", value: "Loyalty Product" },
  ]);

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  return { tenantId, subdomain, email, rawToken };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("S31: admin puan modunu ayarlar, misafir sadakate katılıp bakiyesini siparişinde kullanır", async ({ browser, baseURL }) => {
  const { tenantId, subdomain, email, rawToken } = await createIsolatedTenantWithProduct();
  const service = serviceClient();
  try {
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await staffPage.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await staffPage.getByLabel("E-posta").fill(email);
    await staffPage.getByLabel("Şifre").fill("password123");
    await staffPage.getByRole("button", { name: "Giriş yap" }).click();
    await staffPage.waitForURL(/\/admin$/);

    await staffPage.goto(tenantUrl(baseURL!, subdomain, "/admin/loyalty"));
    await staffPage.getByRole("combobox", { name: "Model" }).click();
    await staffPage.getByRole("option", { name: "Puan" }).click();
    await staffPage.getByLabel("Kazanım Oranı").fill("10");
    await staffPage.getByLabel("Puan Değeri (₺)").fill("1");
    await staffPage.getByRole("button", { name: "Kaydet" }).click();
    // "Kaydet" tıklaması, sunucu action'ının (updateLoyaltyProgram) bitişini
    // beklemeden hemen döner — Faz 6'daki kategori/istasyon kaydetme testinde
    // görülen aynı yarış (bkz. kitchen-station-filter.spec.ts).
    await staffPage.waitForLoadState("networkidle");

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(tenantUrl(baseURL!, subdomain, `/masa/t/${rawToken}`));
    await expect(guestPage).toHaveURL(/\/masa$/);

    // Sadakat bölümü yalnızca iptal edilmemiş en az bir sipariş varken
    // render edilir (session-panel.tsx) — önce sipariş verilir.
    const productCard = guestPage.locator('[data-slot="card"]').filter({ hasText: "Loyalty Ürünü" });
    await productCard.getByRole("button", { name: "Sepete ekle" }).click();
    await guestPage.getByRole("button", { name: "Siparişi Gönder" }).click();
    await expect(guestPage.getByText("Siparişiniz alındı.")).toBeVisible({ timeout: 15_000 });

    await guestPage.getByRole("button", { name: "Oturumum" }).click();
    await guestPage.getByRole("button", { name: "Sadakat Programına Katıl" }).click();
    await guestPage.getByPlaceholder("Telefon numarası").fill("+905552223344");
    await guestPage.getByRole("button", { name: "Kod Gönder" }).click();

    let code: string | undefined;
    await expect
      .poll(
        async () => {
          const { data } = await service.from("sent_sms").select("body").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1);
          code = data?.[0]?.body.match(/\d{6}/)?.[0];
          return code;
        },
        { timeout: 10_000 },
      )
      .toBeTruthy();

    await guestPage.getByPlaceholder("Doğrulama kodu").fill(code!);
    await guestPage.getByLabel(/kişisel verilerimin/i).check();
    await guestPage.getByRole("button", { name: "Doğrula" }).click();
    await expect(guestPage.getByText("Sadakat bakiyeniz: 0")).toBeVisible();

    // Bakiyeyi elle 20 puana ayarla (kazanım akışı entegrasyon testlerinde
    // zaten kapsanıyor — burada misafir tarafının REDEEM UI akışı test
    // edilir). loyaltyBalance sunucu prop'u olduğu için (state'e
    // kopyalanmıyor) dışarıdan yapılan bu değişikliği görmek reload gerektirir.
    const { data: customer } = await service.from("customers").select("id").eq("tenant_id", tenantId).single();
    await service.from("loyalty_balances").insert({ customer_id: customer!.id, tenant_id: tenantId, balance: 20 });
    await guestPage.reload();
    await guestPage.getByRole("button", { name: "Oturumum" }).click();

    await expect(guestPage.getByText("Sadakat bakiyeniz: 20")).toBeVisible();
    await guestPage.getByRole("button", { name: "Kullan" }).click();
    await expect(guestPage.getByText(/Sadakat indirimi uygulandı/)).toBeVisible();

    const { data: comps } = await service.from("comps").select("amount_minor").eq("tenant_id", tenantId);
    expect(comps).toHaveLength(1);
    expect(comps![0].amount_minor).toBe(2000); // 20 puan * 1₺ = ₺20 = 2000 kuruş

    const { data: balance } = await service.from("loyalty_balances").select("balance").eq("customer_id", customer!.id).single();
    expect(balance?.balance).toBe(0);

    await staffContext.close();
    await guestContext.close();
  } finally {
    await deleteTenant(tenantId);
  }
});
