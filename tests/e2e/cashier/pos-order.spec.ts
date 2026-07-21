import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

test("kasa: POS-lite ile tezgâha sipariş girilir", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);
  await page.goto(acmeUrl(baseURL!, "/cashier/order"));

  await page.getByLabel("Masa Seç").click();
  await page.getByRole("option", { name: /Tezgâh/ }).click();

  const coffeeRow = page.getByText("Filtre Kahve", { exact: true }).locator("../..");
  await coffeeRow.getByRole("button", { name: "Siparişe Ekle" }).click();

  await expect(page.getByText("Sipariş", { exact: true })).toBeVisible();
  await expect(page.getByText(/1× Filtre Kahve/)).toBeVisible();

  await page.getByRole("button", { name: "Siparişi Gönder" }).click();
  await expect(page.getByText("Sipariş gönderildi.")).toBeVisible();
});
