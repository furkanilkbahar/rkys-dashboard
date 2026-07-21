import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

async function orderCoffeeAtCounter(page: import("@playwright/test").Page, baseURL: string) {
  await page.goto(acmeUrl(baseURL, "/cashier/order"));
  await page.getByLabel("Masa Seç").click();
  await page.getByRole("option", { name: /Tezgâh/ }).click();
  const coffeeRow = page.getByText("Filtre Kahve", { exact: true }).locator("../..");
  await coffeeRow.getByRole("button", { name: "Siparişe Ekle" }).click();
  await page.getByRole("button", { name: "Siparişi Gönder" }).click();
  await expect(page.getByText("Sipariş gönderildi.")).toBeVisible();
}

test("S10: kasa — ikram uygulanır, bakiye düşer, kalan tutar ödenince hesap kapanır", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);
  await orderCoffeeAtCounter(page, baseURL!);

  await page.goto(acmeUrl(baseURL!, "/cashier/pay"));
  await page.getByRole("button", { name: /Tezgâh/ }).click();

  // Tezgâh masası E2E dosyaları arasında paylaşılır — aynı açık oturumda
  // önceki koşumlardan kalan başka siparişler de olabilir, bu yüzden en son
  // eklenen (dolayısıyla listede en sondaki) sipariş hedeflenir.
  await page.getByRole("button", { name: "+ İkram Ekle" }).last().click();
  await page.getByLabel("Tutar").fill("20");
  await page.getByRole("button", { name: "Uygula" }).click();
  await expect(page.getByText("İkram uygulandı")).toBeVisible();

  await page.getByRole("button", { name: "Ödemeye Başla" }).click();
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page.getByText("Tüm paylar ödendi, hesap kapandı.")).toBeVisible();
});

test("S11: kasa — nakit ödeme tam iade edilir, ödeme durumu 'iade edildi' olur", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);
  await orderCoffeeAtCounter(page, baseURL!);

  await page.goto(acmeUrl(baseURL!, "/cashier/pay"));
  await page.getByRole("button", { name: /Tezgâh/ }).click();
  await page.getByRole("button", { name: "Ödemeye Başla" }).click();
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page.getByText("Tüm paylar ödendi, hesap kapandı.")).toBeVisible();

  const recentCard = page.locator('[data-slot="card"]').filter({ hasText: "Son Ödemeler" });
  await recentCard.getByRole("button", { name: "İade Et" }).first().click();
  await recentCard.getByRole("button", { name: "İadeyi Onayla" }).first().click();
  await expect(recentCard.getByText("İade edildi").first()).toBeVisible();
});
