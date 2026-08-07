import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { loginAsPlatformAdmin, tenantUrl } from "../helpers/tenant";

// Her iki senaryo da platform_settings.auto_approve_registrations tekil
// satırını okuyup yazıyor (D80 genel ayarı) — fullyParallel altında
// birbirinin bayrağını ezmesin diye bu dosya seri çalışır.
test.describe.configure({ mode: "serial" });

// Aynı sabit lokal demo anahtarları — session-panel.spec.ts'deki desenle aynı.
function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

async function cleanupTenant(slug: string, email: string) {
  const service = serviceClient();
  const { data: tenant } = await service.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (tenant) {
    await service.from("tenants").delete().eq("id", tenant.id);
  }
  const { data: authUsers } = await service.auth.admin.listUsers();
  const match = authUsers.users.find((u) => u.email === email);
  if (match) {
    await service.auth.admin.deleteUser(match.id);
  }
}

/** D101: ödeme adımı kalktı — kayıt tek başına trial'ı başlatıyor. */
async function register(page: import("@playwright/test").Page, baseURL: string, businessName: string, slug: string, email: string) {
  await page.goto(`${baseURL}/kayit`);
  // WebKit hidrasyon yarışı (PLAN.md Faz 21 takip maddesi 2): kayıt formu
  // react-hook-form + server action; hidrasyon bitmeden yapılan tıklama
  // sessizce yutuluyor ve sayfa /kayit'ta kalıyor. Mekanizma Faz 21'de
  // kanıtlanmıştı: 0 ms bekleyince 0 POST, 3000 ms bekleyince akış tamam.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("İşletme Adı").fill(businessName);
  await page.getByLabel("Alt Alan Adı").fill(slug);
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Kayıt Ol" }).click();

  await page.waitForURL(/\/kayit\/tamamlandi/, { timeout: 15_000 });
}

test("S52: auto-approve KAPALI — kayıt tek başına yetmez, platform admin onaylayınca giriş açılır", async ({ page, baseURL }) => {
  // slug 32 karakterle sınırlı (registerSchema) — kısa base36 zaman damgası
  // kullanılıyor, ISO milisaniye string'i sığmaz.
  const suffix = Date.now().toString(36);
  const slug = `test-e2e-appr-${suffix}`;
  const businessName = `E2E Onay ${suffix}`;
  const email = `owner-e2e-appr-${suffix}@test-throwaway.test`;

  try {
    await register(page, baseURL!, businessName, slug, email);

    // Kayıt tamamlandı ama tenant hâlâ pending_approval — alt-domain proxy
    // tarafından tamamen kapalı (admin/login dahil).
    const blockedLoginResponse = await page.goto(tenantUrl(baseURL!, slug, "/admin/login"));
    expect(blockedLoginResponse?.ok()).toBe(true);
    // GÜNCELLENDİ 2026-08-04: beklenen metin "Tenant bulunamadı." idi ama
    // sayfa "İşletme bulunamadı." yazıyor — i18n dizesi misafire dönük
    // Türkçeye çevrilirken değişmiş, spec eskimişti (RULES #11: metin
    // i18n'den gelir). Doğrulanan davranış aynı: bilinmeyen/askıya alınmış
    // tenant için "bulunamadı" sayfası.
    await expect(page.getByText("İşletme bulunamadı.")).toBeVisible();

    await loginAsPlatformAdmin(page, baseURL!);
    await page.goto(`${baseURL}/platform/pending-tenants`);
    const pendingRow = page.getByTestId(`pending-tenant-${slug}`);
    await expect(pendingRow.getByRole("button", { name: "Onayla" })).toBeVisible();
    await pendingRow.getByRole("button", { name: "Onayla" }).click();
    await expect(pendingRow).not.toBeVisible();

    await page.goto(tenantUrl(baseURL!, slug, "/admin/login"));
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin\/onboarding/, { timeout: 15_000 });
  } finally {
    await cleanupTenant(slug, email);
  }
});

test("S52: auto-approve AÇIK — kayıt biter bitmez tenant aktif olur, onay beklemeden giriş açılır", async ({ page, baseURL }) => {
  const suffix = Date.now().toString(36);
  const slug = `test-e2e-auto-appr-${suffix}`;
  const businessName = `E2E Otomatik Onay ${suffix}`;
  const email = `owner-e2e-auto-appr-${suffix}@test-throwaway.test`;
  const service = serviceClient();

  await service.from("platform_settings").update({ auto_approve_registrations: true }).eq("id", true);

  try {
    await register(page, baseURL!, businessName, slug, email);

    await page.goto(tenantUrl(baseURL!, slug, "/admin/login"));
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin\/onboarding/, { timeout: 15_000 });
  } finally {
    await service.from("platform_settings").update({ auto_approve_registrations: false }).eq("id", true);
    await cleanupTenant(slug, email);
  }
});
