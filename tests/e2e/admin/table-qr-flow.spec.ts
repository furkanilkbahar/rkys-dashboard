import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

test("owner masa oluşturup QR'ı gösterebilir, üretilen token misafir akışında çalışır", async ({
  page,
  context,
  baseURL,
}) => {
  await loginAsAcmeOwner(page, baseURL!);
  await page.goto(acmeUrl(baseURL!, "/admin/tables"));

  const tableLabel = `Test Masa ${Date.now()}`;
  await page.getByLabel("Masa adı").fill(tableLabel);
  await page.getByRole("button", { name: "+ Masa Ekle" }).click();

  await expect(page.getByText(tableLabel).first()).toBeVisible();
  await expect(page.getByText("PNG İndir")).toBeVisible();

  const urlText = await page.locator("p.break-all").textContent();
  expect(urlText).toBeTruthy();
  const guestUrl = urlText!.trim();

  await page.getByRole("button", { name: "Kapat" }).click();

  // Üretilen QR URL'sini gerçek bir misafir olarak ziyaret et — admin
  // panelinden oluşturulan token'ın Faz 1 misafir akışıyla uçtan uca
  // çalıştığını doğrular.
  const guestPage = await context.newPage();
  await guestPage.goto(guestUrl);
  await expect(guestPage).toHaveURL(/\/masa$/);
  await expect(guestPage.getByText("Filtre Kahve")).toBeVisible();
});
