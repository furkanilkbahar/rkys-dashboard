import path from "node:path";

import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

const FIXTURE = path.join(__dirname, "..", "fixtures", "test-image.png");

test("owner ürüne görsel yükleyebilir ve kalıcı olur", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);

  // Seed'deki "Filtre Kahve" ürününü kullan (İçecekler kategorisinde).
  await page.goto(acmeUrl(baseURL!, "/admin/menu"));
  await page.getByRole("link", { name: "İçecekler Aktif", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/menu\/[^/]+$/);
  await page.getByRole("link", { name: "Filtre Kahve Aktif", exact: true }).click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);

  await expect(page.getByText("Görsel Yükle")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);

  await expect(page.getByText("Yükleniyor...")).toBeHidden({ timeout: 15_000 });
  const productImage = page.locator('img[alt=""]').first();
  await expect(productImage).toBeVisible();
  await expect(productImage).toHaveAttribute("src", /menu-images/);

  await page.reload();
  await expect(page.locator('img[alt=""]').first()).toHaveAttribute("src", /menu-images/);
});
