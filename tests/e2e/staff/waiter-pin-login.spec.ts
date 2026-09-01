import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { gotoSettled, tenantUrl } from "../helpers/tenant";

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
  const subdomain = `test-pinlogin-${suffix}`;
  const email = `owner-pinlogin-${suffix}@test-throwaway.test`;
  const tenantName = `PIN Login Test ${suffix}`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: tenantName, status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  return { tenantId, subdomain, email, tenantName };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("bug-hunt 2026-08-01 (D87): garson kendi PIN'iyle bağımsız giriş yapar, owner çıkışı garsonu düşürmez", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email, tenantName } = await createIsolatedTenant();
  try {
    // 1) Owner girer, yeni bir garson (PIN'li) ve bir yetkili cihaz oluşturur.
    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin$/);

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/staff"));
    // WebKit HİDRASYON KAPISI. İki ayrı belirtiyi de bu kapatıyor:
    //   1) beklemesiz ilk `fill` hidrasyondan önce gidiyor ve react-hook-form
    //      alanı devralınca boşaltıyor (snapshot'ta "Ad Soyad" boş, diğerleri
    //      dolu görünüyordu — Ad Soyad 0091/D94 ile zorunlu, kayıt oluşmuyor),
    //   2) beklemesiz tıklama sessizce yutuluyor: formun native submit'i yok,
    //      `handleSubmit` yalnızca React tarafında bağlanıyor.
    //
    // `networkidle` BU İŞE YETMEZ — ağın boşaldığını söyler, React'in olay
    // dinleyicilerini bağladığını değil (eklendiğinde 1 düzeldi, 2 kaldı).
    // Rol seçicisi saf client bileşeni: AÇILIYORSA hidrasyon bitmiştir. Kapı
    // aynı zamanda rolü açıkça seçiyor, yani ek bir yan etkisi yok.
    const createCard = page.locator('[data-slot="card"]').filter({ hasText: "Personel Ekle" });
    await createCard.getByRole("combobox", { name: "Rol" }).click();
    await page.getByRole("option", { name: "Garson" }).click();
    // Ad Soyad 0091/D94 ile ZORUNLU alan oldu: adsız açılan personel listede
    // yalnızca rozetle ayırt edilebiliyordu, rozet de opsiyonel — aynı açığı
    // tekrar üretmemek için ad girişte isteniyor.
    await page.locator("#create-full-name").fill("Deniz Aydın");
    await page.locator("#create-badge-no").fill("G1");
    await page.locator("#create-pin").fill("1234");
    await page.getByRole("button", { name: "+ Personel Ekle" }).click();
    await page.waitForLoadState("networkidle");

    const service = serviceClient();
    const { data: newStaff } = await service
      .from("profiles")
      .select("id, role, badge_no, pin_hash")
      .eq("tenant_id", tenantId)
      .eq("badge_no", "G1")
      .single();
    expect(newStaff?.role).toBe("waiter");
    expect(newStaff?.pin_hash).not.toBeNull();

    await page.getByLabel("Cihaz etiketi").fill("Test Tableti");
    await page.getByRole("button", { name: "+ Cihaz Ekle" }).click();
    await expect(page.getByText("Cihaz Şifresi")).toBeVisible({ timeout: 10_000 });
    const deviceSecret = await page.locator("p.font-mono").textContent();
    expect(deviceSecret).toBeTruthy();

    // 2) AYNI taraycıda (owner hâlâ admin oturumunda) cihaz kurulumu yapılır
    // — device cookie'leri Supabase Auth oturumundan tamamen bağımsızdır.
    // `gotoSettled`: cihaz ekleme server action'ının `router.refresh()`'i bu
    // gezinmeyi kesebiliyor (bkz. helpers/tenant.ts).
    await gotoSettled(page, tenantUrl(baseURL!, subdomain, "/vardiya/kurulum"));
    await page.getByLabel("Cihaz Anahtarı").fill(deviceSecret!.trim());
    await page.getByRole("button", { name: "Kaydet" }).click();
    await page.waitForURL(/\/vardiya$/);

    // 3) Garson kendi PIN'iyle /waiter/login üzerinden bağımsız giriş yapar.
    await page.goto(tenantUrl(baseURL!, subdomain, "/waiter/login"));
    for (const digit of "1234") {
      await page.getByRole("button", { name: digit, exact: true }).click();
    }
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    await page.waitForURL(/\/waiter$/);
    await expect(page.getByRole("heading", { name: "Garson Paneli" })).toBeVisible();

    // 4) Owner'ın admin oturumu HÂLÂ ayrı ve geçerli olmalı.
    await page.goto(tenantUrl(baseURL!, subdomain, "/admin"));
    await expect(page).not.toHaveURL(/\/admin\/login$/);

    // 5) Owner çıkış yapar.
    await page.getByRole("button", { name: tenantName }).click();
    await page.getByRole("menuitem", { name: "Çıkış yap" }).click();
    await page.waitForURL(/\/admin\/login$/);

    // 6) KÖK BUG: owner çıkışı garsonun ayrı oturumunu ETKİLEMEMELİ.
    await page.goto(tenantUrl(baseURL!, subdomain, "/waiter"));
    await expect(page).not.toHaveURL(/\/waiter\/login$/);
    await expect(page.getByRole("heading", { name: "Garson Paneli" })).toBeVisible();

    // 7) Garson kendi "Çıkış" butonuyla yalnızca KENDİ oturumunu kapatır.
    await page.getByRole("button", { name: "Çıkış" }).click();
    await page.waitForURL(/\/waiter\/login$/);
  } finally {
    await deleteTenant(tenantId);
  }
});
