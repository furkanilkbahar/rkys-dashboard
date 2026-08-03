import { expect, test } from "@playwright/test";

import { betaUrl, loginAsBetaOwner } from "../helpers/tenant";

test("S16: admin para birimini değiştirir, misafir menüsü yeni birimle ve seçili dille görünür", async ({
  page,
  baseURL,
}) => {
  await loginAsBetaOwner(page, baseURL!);
  await page.goto(betaUrl(baseURL!, "/admin/settings"));

  const businessCard = page.locator('[data-slot="card"]').filter({ hasText: "İşletme Ayarları" });
  await businessCard.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "USD" }).click();
  await businessCard.getByRole("button", { name: "Kaydet" }).click();
  await page.waitForLoadState("networkidle");

  await page.goto(betaUrl(baseURL!, "/masa/t/demo-beta-table-1"));
  await expect(page.getByText("$150,00")).toBeVisible();

  // Faz 21: kategori adı artık İKİ yerde geçiyor — yeni yatay kategori
  // şeridinde (link) ve bölüm başlığında (heading). Metin değişmedi, DOM'a
  // brief'in (§2.2 kural 3) istediği şerit eklendi; locator anlamlı olana,
  // başlığa daraltıldı (Faz 19'da app-boots.spec.ts'e uygulanan aynı desen).
  await expect(page.getByRole("heading", { name: "Ana Yemekler" })).toBeVisible();
  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("heading", { name: "Main Courses" })).toBeVisible();

  // Dil EN'e geçtiği için admin login sayfası da İngilizce render olur —
  // ikinci girişten önce arayüz dili tekrar tr'ye alınır.
  await page.evaluate(() => {
    document.cookie = "rkys-locale=tr; path=/; max-age=31536000; samesite=lax";
  });

  // Diğer beta E2E testlerini etkilememek için para birimi TRY'ye geri alınır.
  await loginAsBetaOwner(page, baseURL!);
  await page.goto(betaUrl(baseURL!, "/admin/settings"));
  const businessCardAgain = page.locator('[data-slot="card"]').filter({ hasText: "İşletme Ayarları" });
  await businessCardAgain.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "TRY" }).click();
  await businessCardAgain.getByRole("button", { name: "Kaydet" }).click();
  await page.waitForLoadState("networkidle");
});
