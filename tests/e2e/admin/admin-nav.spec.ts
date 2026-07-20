import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

test("girişsiz ziyaretçi /admin'e girince login'e yönlenir", async ({ page, baseURL }) => {
  await page.goto(acmeUrl(baseURL!, "/admin"));
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("owner girişiyle admin nav kabuğu görünür ve bölümler arası geçiş çalışır", async ({ page, baseURL, isMobile }) => {
  test.skip(isMobile, "Masaüstü sidebar lg breakpoint altında bilerek gizli — mobil nav ayrı testte kapsanıyor.");
  await loginAsAcmeOwner(page, baseURL!);

  await expect(page.getByRole("heading", { name: /Hoş geldin/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Menü" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Masalar" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Personel" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ayarlar" })).toBeVisible();

  await page.getByRole("link", { name: "Menü" }).click();
  await expect(page).toHaveURL(/\/admin\/menu$/);
  await expect(page.getByText("Bu bölüm bir sonraki adımda geliyor")).toBeVisible();
});

test("çıkış yap admin oturumunu kapatır", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);

  await page.getByRole("button", { name: "owner" }).click();
  await page.getByText("Çıkış yap").click();

  await expect(page).toHaveURL(/\/admin\/login$/);

  await page.goto(acmeUrl(baseURL!, "/admin"));
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("mobil görünümde hamburger menüsü nav çekmecesini açar", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAsAcmeOwner(page, baseURL!);

  await expect(page.getByRole("link", { name: "Menü" })).toBeHidden();
  await page.getByRole("button", { name: "Menüyü aç" }).click();
  await expect(page.getByRole("link", { name: "Menü" })).toBeVisible();

  await page.getByRole("link", { name: "Masalar" }).click();
  await expect(page).toHaveURL(/\/admin\/tables$/);
});
