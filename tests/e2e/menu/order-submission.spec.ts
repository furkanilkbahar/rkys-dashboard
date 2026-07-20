import { expect, test } from "@playwright/test";

import { acmeUrl } from "../helpers/tenant";

test("misafir sepete ürün ekleyip siparişi gönderebilir", async ({ page, baseURL }) => {
  await page.goto(acmeUrl(baseURL!, "/masa/t/demo-acme-table-2"));
  await expect(page).toHaveURL(/\/masa$/);

  const coffeeCard = page.locator('[data-slot="card"]').filter({ hasText: "Filtre Kahve" });
  await coffeeCard.getByRole("button", { name: "Sepete ekle" }).click();

  await expect(page.getByText("1 ürün")).toBeVisible();

  await page.getByRole("button", { name: "Siparişi Gönder" }).click();
  await expect(page.getByText("Siparişiniz alındı.")).toBeVisible({ timeout: 10_000 });
});
