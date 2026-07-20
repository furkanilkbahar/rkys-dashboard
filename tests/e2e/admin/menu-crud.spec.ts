import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

test("owner kategori+ürün+varyant+ekstra oluşturup çeviri editörünü kullanabilir", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);

  await page.goto(acmeUrl(baseURL!, "/admin/menu/new"));
  await page.getByLabel("Ad (Türkçe)").first().fill("Sıcak İçecekler");
  await page.getByLabel("Ad (İngilizce)").first().fill("Hot Drinks");
  await page.getByRole("button", { name: "Kaydet" }).click();

  await expect(page).toHaveURL(/\/admin\/menu$/);
  await expect(page.getByText("Sıcak İçecekler").first()).toBeVisible();

  await page.getByText("Sıcak İçecekler").first().click();
  await expect(page).toHaveURL(/\/admin\/menu\/[^/]+$/);
  await expect(page.getByText("Kategoriyi Düzenle")).toBeVisible();

  await page.getByRole("button", { name: "+ Ürün Ekle" }).click();
  await expect(page).toHaveURL(/\/products\/new$/);
  await expect(page.getByText("Yeni Ürün")).toBeVisible();
  await page.getByLabel("Ad (Türkçe)").first().fill("Espresso");
  await page.getByLabel("Fiyat (₺)").fill("35.00");
  await page.getByRole("button", { name: "Kaydet" }).click();

  await expect(page).toHaveURL(/\/admin\/menu\/[^/]+$/);
  await expect(page.getByText("Espresso").first()).toBeVisible();
  await page.getByText("Espresso").first().click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await expect(page.getByText("Ürünü Düzenle")).toBeVisible();

  // Varyant ekle — "ekle" formu listede her zaman en sonda render edilir.
  const variantSection = page.getByTestId("variant-editor");
  await variantSection.getByPlaceholder("Ad (Türkçe)").last().fill("Tekli");
  await variantSection.getByPlaceholder("Fiyat (₺)").last().fill("35.00");
  await variantSection.getByRole("button", { name: "+ Varyant Ekle" }).click();
  await expect(variantSection.getByText("Varyant yok.")).toBeHidden();

  // Ekstra ekle
  const extraSection = page.getByTestId("extra-editor");
  await extraSection.getByPlaceholder("Ad (Türkçe)").last().fill("Ekstra Shot");
  await extraSection.getByPlaceholder("Fiyat (₺)").last().fill("10.00");
  await extraSection.getByRole("button", { name: "+ Ekstra Ekle" }).click();
  await expect(extraSection.getByText("Ekstra yok.")).toBeHidden();

  await page.reload();
  await expect(page.getByTestId("variant-editor").getByPlaceholder("Ad (Türkçe)").first()).toHaveValue("Tekli");
  await expect(page.getByTestId("extra-editor").getByPlaceholder("Ad (Türkçe)").first()).toHaveValue("Ekstra Shot");
});

test("waiter (menu.edit izni olmayan rol) kategori oluşturamaz", async ({ page, baseURL }) => {
  await page.goto(acmeUrl(baseURL!, "/admin/login"));
  await page.getByLabel("E-posta").fill("waiter@acme.test");
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/admin$/);

  await page.goto(acmeUrl(baseURL!, "/admin/menu/new"));
  await page.getByLabel("Ad (Türkçe)").first().fill("Yetkisiz Kategori");
  await page.getByRole("button", { name: "Kaydet" }).click();

  await expect(page.getByText("Bu işlem için yetkiniz yok.")).toBeVisible();
});
