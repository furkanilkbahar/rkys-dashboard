import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

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
  const subdomain = `test-schedule-${suffix}`;
  const email = `owner-schedule-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Scheduling Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert({ tenant_id: tenantId, module_key: "staff_scheduling", is_enabled: true });

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true, badge_no: "OWN-1" });

  return { tenantId, subdomain, email };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("S47: admin cihaz+PIN oluşturur, cihaz kurulur, PIN ile giriş-çıkış yapılır, çizelge+saat raporu görünür", async ({ browser, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenant();
  try {
    const adminContext = await browser.newContext();
    const page = await adminContext.newPage();
    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin$/);

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/staff"));
    // WebKit hidrasyon yarışı (PLAN.md Faz 21 takip maddesi 2): formlar
    // react-hook-form + server action ile çalışıyor, hidrasyon bitmeden
    // yapılan tıklama sessizce yutuluyor (native submit yok).
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Cihaz etiketi").fill("Vardiya Tableti");
    await page.getByRole("button", { name: "+ Cihaz Ekle" }).click();
    await expect(page.getByText("Cihaz Şifresi")).toBeVisible();
    const deviceSecret = await page.locator("p.font-mono").textContent();
    expect(deviceSecret).toBeTruthy();
    await page.getByRole("button", { name: "Onayla" }).click();

    await page.getByRole("button", { name: "PIN Sıfırla" }).first().click();
    await page.getByLabel("Yeni PIN (4-8 hane)").fill("1234");
    await page.getByRole("button", { name: "PIN Sıfırla" }).last().click();
    await page.waitForLoadState("networkidle");

    const deviceContext = await browser.newContext();
    const devicePage = await deviceContext.newPage();
    await devicePage.goto(tenantUrl(baseURL!, subdomain, "/vardiya/kurulum"));
    await devicePage.waitForLoadState("networkidle");
    await devicePage.getByLabel("Cihaz Anahtarı").fill(deviceSecret!.trim());
    await devicePage.getByRole("button", { name: "Kaydet" }).click();
    await expect(devicePage).toHaveURL(/\/vardiya$/);

    for (const digit of ["1", "2", "3", "4"]) {
      await devicePage.getByRole("button", { name: digit, exact: true }).click();
    }
    await devicePage.getByRole("button", { name: "Onayla" }).click();
    await expect(devicePage.getByText(/Hoş geldin, OWN-1! Giriş yapıldı\./)).toBeVisible();

    for (const digit of ["1", "2", "3", "4"]) {
      await devicePage.getByRole("button", { name: digit, exact: true }).click();
    }
    await devicePage.getByRole("button", { name: "Onayla" }).click();
    await expect(devicePage.getByText(/Görüşürüz, OWN-1! Çıkış yapıldı\./)).toBeVisible();

    const service = serviceClient();
    const { data: entry } = await service.from("timeclock_entries").select("clock_in_at, clock_out_at").eq("tenant_id", tenantId).single();
    expect(entry?.clock_out_at).not.toBeNull();

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/scheduling"));
    // WebKit hidrasyon yarışı (PLAN.md Faz 21 takip maddesi 2): formlar
    // react-hook-form + server action ile çalışıyor, hidrasyon bitmeden
    // yapılan tıklama sessizce yutuluyor (native submit yok).
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("OWN-1").first()).toBeVisible();

    const shiftDate = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    await page.getByRole("combobox", { name: "Personel" }).click();
    await page.getByRole("option", { name: "OWN-1" }).click();
    await page.getByLabel("Tarih").fill(shiftDate);
    await page.getByRole("button", { name: "+ Ekle" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(shiftDate)).toBeVisible();

    await adminContext.close();
    await deviceContext.close();
  } finally {
    await deleteTenant(tenantId);
  }
});
