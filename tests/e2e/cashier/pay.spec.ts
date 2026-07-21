import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

test("S18: kasa — eşit bölüşme ve bahşiş akışı uçtan uca", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);

  // Bahşiş çipi olmadan tip seçim adımı test edilemez — ayarlar üzerinden bir tane eklenir.
  await page.goto(acmeUrl(baseURL!, "/admin/settings"));
  const tipLabel = `E2E ${Date.now()}`;
  // .fill() bazen WebKit'te react-hook-form'un controlled input state'ini
  // güncellemeden DOM value'sunu set ediyor (input/change event'i doğru
  // tetiklenmiyor) — pressSequentially() gerçek tuş vuruşu simüle ederek
  // bunu güvenilir hale getirir (mobile-safari'de tekrarlanan zaman aşımı
  // kök nedeni buydu, ürün kodu değil).
  await page.locator("#new-tip-label").click();
  await page.locator("#new-tip-label").pressSequentially(tipLabel);
  await page.locator("#new-tip-percentage").fill("10");
  await page.getByRole("button", { name: "+ Bahşiş Çipi Ekle" }).click();
  await page.waitForLoadState("networkidle");

  // Tezgâha bir sipariş girilir.
  await page.goto(acmeUrl(baseURL!, "/cashier/order"));
  await page.getByLabel("Masa Seç").click();
  await page.getByRole("option", { name: /Tezgâh/ }).click();
  const coffeeRow = page.getByText("Filtre Kahve", { exact: true }).locator("../..");
  await coffeeRow.getByRole("button", { name: "Siparişe Ekle" }).click();
  await page.getByRole("button", { name: "Siparişi Gönder" }).click();
  await expect(page.getByText("Sipariş gönderildi.")).toBeVisible();

  // Ödeme ekranında hesap seçilir, bahşiş + eşit bölüşme uygulanır.
  await page.goto(acmeUrl(baseURL!, "/cashier/pay"));
  await page.getByRole("button", { name: /Tezgâh/ }).click();
  await page.getByRole("button", { name: `${tipLabel} (%10)` }).click();
  await page.getByLabel("Kaç Kişi Bölüşecek").fill("2");
  await page.getByRole("button", { name: "Ödemeye Başla" }).click();

  await expect(page.getByText("Ödeme Payları")).toBeVisible();
  const payButtons = page.getByRole("button", { name: "Öde" });
  await expect(payButtons).toHaveCount(2);
  await payButtons.first().click();
  await expect(page.getByText("Ödendi").first()).toBeVisible();
  await page.getByRole("button", { name: "Öde" }).click();

  await expect(page.getByText("Tüm paylar ödendi, hesap kapandı.")).toBeVisible();
});
