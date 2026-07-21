import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

test("kasa: vardiya açılır, nakit hareketi eklenir, sayım+fark ile kapatılır", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);
  await page.goto(acmeUrl(baseURL!, "/cashier"));

  await expect(page.getByText("Vardiya Aç")).toBeVisible();
  await page.getByLabel(/Açılış Bakiyesi/).fill("500");
  await page.getByRole("button", { name: "Vardiyayı Aç" }).click();

  await expect(page.getByText("Açık Vardiya")).toBeVisible();
  await expect(page.getByText("500,00")).toBeVisible();

  await page.getByLabel("Tutar").fill("50");
  await page.getByLabel("Not").fill("Test giriş");
  await page.getByRole("button", { name: "Ekle" }).click();

  await expect(page.getByText("Kasa Hareketleri")).toBeVisible();
  await expect(page.getByText("Henüz hareket yok.")).toBeHidden();

  // beklenen = 500 (açılış) + 50 (nakit giriş) = 550 — sayılanı kasıtlı
  // farklı girip fark satırının doğru göründüğünü de doğruluyoruz.
  await page.getByLabel("Sayılan Nakit").fill("560");
  await page.getByRole("button", { name: "Vardiyayı Kapat" }).click();

  await expect(page.getByText("Vardiya Aç")).toBeVisible();
  await expect(page.getByText("Son Kapanan Vardiya")).toBeVisible();
  await expect(page.getByText(/Fark:\s*₺10,00/)).toBeVisible();
});
