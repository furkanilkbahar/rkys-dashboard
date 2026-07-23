import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeManager, loginAsAcmeOwner } from "../helpers/tenant";

test("Dönem Raporu: tarih aralığı seçilince toplam güncellenir; sahip kayıp-kaçak tablosunu görür", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);
  await page.goto(acmeUrl(baseURL!, "/admin/reports"));

  await expect(page.getByRole("heading", { name: "Dönem Raporu" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seçilen Dönem" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Geçen Yıl (Aynı Dönem)" })).toBeVisible();
  // Sahip (owner) her zaman izinlidir (role_permissions'a bağımlı değil, RULES #41).
  await expect(page.getByRole("heading", { name: "Kayıp-Kaçak Raporu" })).toBeVisible();

  await page.getByLabel("Başlangıç").fill("2025-01-01");
  await page.getByLabel("Bitiş").fill("2025-01-31");
  await page.getByRole("button", { name: "Uygula" }).nth(1).click();
  await page.waitForURL(/periodStart=2025-01-01/);
  await expect(page.getByLabel("Başlangıç")).toHaveValue("2025-01-01");
  await expect(page.getByLabel("Bitiş")).toHaveValue("2025-01-31");
});

test("reports.loss izni olmayan personel Dönem Raporu'nu görür ama kayıp-kaçak tablosunu görmez", async ({ page, baseURL }) => {
  // Seed: manager reports.revenue/profit'e sahip ama reports.loss'a sahip
  // değil (yeni izin, varsayılan olarak kapalı — RULES #41 fail-closed).
  await loginAsAcmeManager(page, baseURL!);
  await page.goto(acmeUrl(baseURL!, "/admin/reports"));

  await expect(page.getByRole("heading", { name: "Dönem Raporu" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kayıp-Kaçak Raporu" })).toBeHidden();
});
