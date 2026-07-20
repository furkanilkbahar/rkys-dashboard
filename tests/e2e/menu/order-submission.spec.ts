import { expect, test } from "@playwright/test";

function acmeUrl(baseURL: string, path: string): string {
  const url = new URL(baseURL);
  url.hostname = `acme.${url.hostname}`;
  url.pathname = path;
  return url.toString();
}

test("misafir sepete ürün ekleyip siparişi gönderebilir", async ({ page, baseURL }) => {
  await page.goto(acmeUrl(baseURL!, "/masa/t/demo-acme-table-2"));
  await expect(page).toHaveURL(/\/masa$/);

  const coffeeCard = page.locator('[data-slot="card"]').filter({ hasText: "Filtre Kahve" });
  await coffeeCard.getByRole("button", { name: "Sepete ekle" }).click();

  await expect(page.getByText("1 ürün")).toBeVisible();

  await page.getByRole("button", { name: "Siparişi Gönder" }).click();
  await expect(page.getByText("Siparişiniz alındı.")).toBeVisible({ timeout: 10_000 });
});
