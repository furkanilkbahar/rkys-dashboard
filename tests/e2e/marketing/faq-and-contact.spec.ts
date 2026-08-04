import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { loginAsPlatformAdmin } from "../helpers/tenant";

// Aynı sabit lokal demo anahtarları — session-panel.spec.ts'deki desenle aynı.
function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

test("S58: SSS akordiyonu sorulara tıklanınca cevabı açar", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/sss`);
  await expect(page.getByRole("heading", { name: "Sıkça Sorulan Sorular" })).toBeVisible();

  await page.getByText("Kayıt olduktan sonra hemen kullanabilir miyim?").click();
  await expect(page.getByText("Ödemeniz onaylandıktan sonra")).toBeVisible();
});

test("S58: iletişim formu gönderilir, platform admin talebi görüp kapatabilir", async ({ page, baseURL }) => {
  const email = `e2e-contact-${Date.now()}@test-throwaway.test`;

  try {
    await page.goto(`${baseURL}/iletisim`);
    // WebKit hidrasyon yarışı (PLAN.md Faz 21 takip maddesi 2): form
    // react-hook-form + server action ile çalışıyor; hidrasyon bitmeden
    // yapılan tıklama sessizce yutuluyor, native submit yok.
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Ad Soyad").fill("E2E İletişim Testi");
    await page.getByLabel("İşletme Adı (opsiyonel)").fill("E2E Test Kafe");
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Mesajınız").fill("Bu bir E2E test mesajıdır.");
    await page.getByRole("button", { name: "Gönder" }).click();
    await expect(page.getByText("Talebiniz alındı")).toBeVisible();

    await loginAsPlatformAdmin(page, baseURL!);
    await page.goto(`${baseURL}/platform/contact-requests`);
    const row = page.locator('[data-testid^="contact-request-"]', { hasText: email });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "İletişime Geçildi" }).click();
    await expect(row.getByText("İletişime Geçildi")).toBeVisible();
  } finally {
    await serviceClient().from("contact_requests").delete().eq("email", email);
  }
});
