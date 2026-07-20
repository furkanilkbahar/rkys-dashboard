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

test("girişsiz ziyaretçi /waiter'a girince login'e yönlenir", async ({ page, baseURL }) => {
  await page.goto(acmeUrl(baseURL!, "/waiter"));
  await expect(page).toHaveURL(/\/admin\/login$/);
});
