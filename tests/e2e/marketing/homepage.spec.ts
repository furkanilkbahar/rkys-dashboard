import { expect, test } from "@playwright/test";

test("S56/S57: ana sayfa gerçek fiyat, modül vitrini ve entegrasyon şeridini gösterir", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`);

  await expect(page.getByText("Başlangıç").first()).toBeVisible();
  await expect(page.getByText("₺499").first()).toBeVisible();
  await expect(page.getByText("Sınırsız masa").first()).toBeVisible();

  await expect(page.getByText("İhtiyacınız olan modülü açın")).toBeVisible();
  await expect(page.getByText("Vardiya, gün sonu ve kasa raporları")).toBeVisible();

  await expect(page.getByText("Zaten kullandığınız araçlarla çalışır")).toBeVisible();
  await expect(page.getByText("Yemeksepeti").first()).toBeVisible();

  await expect(page.getByText("Neden RKYS Dashboard")).toBeVisible();
});

test("S59: blog sayfası boş durum gösterir", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/blog`);
  await expect(page.getByRole("heading", { name: "Blog" })).toBeVisible();
  await expect(page.getByText("Yakında burada olacağız")).toBeVisible();
});
