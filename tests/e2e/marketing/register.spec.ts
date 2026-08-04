import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// Aynı sabit lokal demo anahtarları — session-panel.spec.ts'deki desenle aynı.
function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

test("S20: kayıt — pazarlama sitesinden self-servis kayıt → kök domainde ödeme → kaydınız alındı sayfası (D80: kapalı kapı, onay bekliyor)", async ({
  page,
  baseURL,
}) => {
  const suffix = Date.now();
  const slug = `test-e2e-signup-${suffix}`;
  const email = `owner-e2e-signup-${suffix}@test-throwaway.test`;

  try {
    await page.goto(`${baseURL}/kayit`);
    // WebKit hidrasyon yarışı (PLAN.md Faz 21 takip maddesi 2): kayıt formu
    // react-hook-form + server action; hidrasyon bitmeden yapılan tıklama
    // sessizce yutuluyor ve sayfa /kayit'ta kalıyor.
    await page.waitForLoadState("networkidle");
    await page.getByLabel("İşletme Adı").fill("E2E Test İşletmesi");
    await page.getByLabel("Alt Alan Adı").fill(slug);
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Kayıt Ol" }).click();

    // Ödeme kök domainde ayrı bir rotada (/kayit/odeme) — tenant henüz
    // pending_approval olduğundan kendi alt-domaini proxy tarafından
    // tamamen kapalı, bu yüzden ödeme adımı alt-domaine düşemez.
    await page.waitForURL(/\/kayit\/odeme\//, { timeout: 15_000 });
    await page.getByRole("button", { name: "Ödemeyi Onayla" }).click();

    await page.waitForURL(/\/kayit\/tamamlandi/, { timeout: 15_000 });
    await expect(page.getByText("Kaydınız Alındı")).toBeVisible();
  } finally {
    const service = serviceClient();
    const { data: tenant } = await service.from("tenants").select("id").eq("slug", slug).maybeSingle();
    if (tenant) {
      await service.from("tenants").delete().eq("id", tenant.id);
    }
    const { data: authUser } = await service.auth.admin.listUsers();
    const match = authUser.users.find((u) => u.email === email);
    if (match) {
      await service.auth.admin.deleteUser(match.id);
    }
  }
});

test("S20: aynı alt alan adıyla ikinci kayıt reddedilir", async ({ page, baseURL }) => {
  const suffix = Date.now();
  const slug = `test-e2e-dup-${suffix}`;
  const service = serviceClient();

  const tenantId = crypto.randomUUID();
  await service.from("tenants").insert({
    id: tenantId,
    slug,
    name: "Zaten Var",
    status: "active",
    timezone: "Europe/Istanbul",
    currency: "TRY",
  });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${slug}.localhost:3000`, is_primary: true });

  try {
    await page.goto(`${baseURL}/kayit`);
    // WebKit hidrasyon yarışı (PLAN.md Faz 21 takip maddesi 2): kayıt formu
    // react-hook-form + server action; hidrasyon bitmeden yapılan tıklama
    // sessizce yutuluyor, hata mesajı da hiç çıkmıyor.
    await page.waitForLoadState("networkidle");
    await page.getByLabel("İşletme Adı").fill("Yeni Deneme");
    await page.getByLabel("Alt Alan Adı").fill(slug);
    await page.getByLabel("E-posta").fill(`owner-e2e-dup-${suffix}@test-throwaway.test`);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Kayıt Ol" }).click();

    await expect(page.getByText("Bu alt alan adı zaten kullanılıyor.")).toBeVisible();
  } finally {
    await service.from("tenants").delete().eq("id", tenantId);
  }
});
