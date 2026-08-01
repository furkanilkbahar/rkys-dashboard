import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

test("owner girişiyle garson paneli açılır", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);
  await page.goto(acmeUrl(baseURL!, "/waiter"));
  await expect(page.getByRole("heading", { name: "Garson Paneli" })).toBeVisible();
});

test("owner girişiyle KDS açılır", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);
  await page.goto(acmeUrl(baseURL!, "/kitchen"));
  await expect(page.getByRole("heading", { name: "Mutfak Ekranı (KDS)" })).toBeVisible();
});

test("girişsiz ziyaretçi /waiter'a girince kendi PIN login'ine yönlenir (D87, admin/login'e değil)", async ({ page, baseURL }) => {
  await page.goto(acmeUrl(baseURL!, "/waiter"));
  await expect(page).toHaveURL(/\/waiter\/login$/);
});
