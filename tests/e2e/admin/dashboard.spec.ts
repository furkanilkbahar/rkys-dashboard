import { expect, test } from "@playwright/test";

import { loginAsAcmeOwner, loginAsAcmeWaiter } from "../helpers/tenant";

/**
 * Faz 23 Adım 2 — Pano.
 *
 * Bu spec SAYI DOĞRULAMAZ: acme paylaşılan bir tenant ve rakamlar (dolu masa,
 * bekleyen çağrı, bugünkü sipariş) diğer spec'lerin bıraktığı duruma göre
 * değişir. Doğrulanan şey panonun SÖZLEŞMESİ: hangi bölümler var, rakamlar
 * hangi rapora bağlanıyor, izin kapısı çalışıyor mu.
 */
test("pano bölümleri görünür ve KPI kartları rapora bağlanır", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);

  await expect(page.getByRole("heading", { name: /Hoş geldiniz/ })).toBeVisible();

  await expect(page.getByText("Bugünkü ciro")).toBeVisible();
  await expect(page.getByText("Ortalama sepet")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Şu an" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dikkat gerektirenler" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hızlı işlemler" })).toBeVisible();

  // KPI kartı rakamın DAYANDIĞI rapora, o günün tarihi seçili olarak gider.
  await page.getByText("Bugünkü ciro").click();
  await expect(page).toHaveURL(/\/admin\/reports\?date=\d{4}-\d{2}-\d{2}$/);
});

test("hızlı işlemler en sık kullanılan sayfalara götürür", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);

  await page.getByRole("link", { name: "Masa ve QR yönet" }).click();
  await expect(page).toHaveURL(/\/admin\/tables$/);
});

test("reports.revenue izni olmayan personelde ciro kartları hiç render edilmez", async ({ page, baseURL }) => {
  // acme seed'inde manager'ın reports.revenue izni VAR, garsonun YOK — bu
  // yüzden kapı garsonla doğrulanıyor. İki beklenti birlikte sözleşmeyi
  // kurar: izinli bölüm gizleniyor AMA sayfa çalışmaya devam ediyor (RULES
  // #41 — izin eksikse gizle, çökme).
  await loginAsAcmeWaiter(page, baseURL!);

  await expect(page.getByRole("heading", { name: "Şu an" })).toBeVisible();
  await expect(page.getByText("Bugünkü ciro")).toBeHidden();
  await expect(page.getByText("Ortalama sepet")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Bugünün çok satanları" })).toBeHidden();
});

test("pano telefonda yatay taşma üretmez", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsAcmeOwner(page, baseURL!);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
