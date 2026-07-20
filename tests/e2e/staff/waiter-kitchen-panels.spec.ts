import { expect, test } from "@playwright/test";

function acmeUrl(baseURL: string, path: string): string {
  const url = new URL(baseURL);
  url.hostname = `acme.${url.hostname}`;
  url.pathname = path;
  return url.toString();
}

async function loginAsAcmeOwner(page: import("@playwright/test").Page, baseURL: string) {
  await page.goto(acmeUrl(baseURL, "/admin/login"));
  await page.getByLabel("E-posta").fill("owner@acme.test");
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/admin$/);
}

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
