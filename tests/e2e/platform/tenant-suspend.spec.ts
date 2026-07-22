import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { loginAsPlatformAdmin, tenantUrl } from "../helpers/tenant";

const GAMMA_TENANT_ID = "00000000-0000-4000-8000-000000000003";

// Aynı sabit lokal demo anahtarları — session-panel.spec.ts'deki desenle aynı.
async function reactivateGamma() {
  const service = createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
  await service.from("tenants").update({ status: "active" }).eq("id", GAMMA_TENANT_ID);
}

test.afterEach(async () => {
  // Test başarısız olup "Tekrar aktifleştir" adımına ulaşamazsa bile gamma
  // diğer testleri (onboarding.spec.ts vb.) bozmasın diye HER zaman çalışır.
  await reactivateGamma();
});

test("S14: Süper Admin — tenant askıya al → tenant yüzeyleri kilitlenir, tekrar aktifleştirince geri gelir", async ({
  page,
  baseURL,
}) => {
  await loginAsPlatformAdmin(page, baseURL!);
  await page.goto(`${baseURL}/platform/tenants/${GAMMA_TENANT_ID}`);
  await expect(page.getByRole("button", { name: "Askıya al" })).toBeVisible();
  await page.getByRole("button", { name: "Askıya al" }).click();
  await expect(page.getByRole("button", { name: "Tekrar aktifleştir" })).toBeVisible();

  const adminLoginResponse = await page.goto(tenantUrl(baseURL!, "gamma", "/admin/login"));
  expect(adminLoginResponse?.ok()).toBe(true);
  await expect(page.getByText("Tenant bulunamadı.")).toBeVisible();

  const guestMenuResponse = await page.goto(tenantUrl(baseURL!, "gamma", "/masa/t/demo-gamma-table-1"));
  expect(guestMenuResponse?.ok()).toBe(true);
  await expect(page.getByText("Tenant bulunamadı.")).toBeVisible();

  await page.goto(`${baseURL}/platform/tenants/${GAMMA_TENANT_ID}`);
  await page.getByRole("button", { name: "Tekrar aktifleştir" }).click();
  await expect(page.getByRole("button", { name: "Askıya al" })).toBeVisible();

  await page.goto(tenantUrl(baseURL!, "gamma", "/admin/login"));
  await expect(page.getByLabel("E-posta")).toBeVisible();
});
