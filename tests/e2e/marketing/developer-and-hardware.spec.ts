import { expect, test } from "@playwright/test";

test("S60: geliştirici dokümantasyon sayfası API/webhook içeriğini gösterir", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/gelistirici`);
  await expect(page.getByRole("heading", { name: "Geliştirici Dokümantasyonu" })).toBeVisible();
  await expect(page.getByText("Authorization: Bearer", { exact: false })).toBeVisible();
  await expect(page.getByText("order.status_changed", { exact: false })).toBeVisible();
});

test("S61: donanım sayfası bugün çalışan cihazları ve yol haritasını gösterir", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/donanim`);
  await expect(page.getByRole("heading", { name: "Donanım Uyumluluğu" })).toBeVisible();
  await expect(page.getByText("Misafir QR menüsü")).toBeVisible();
  await expect(page.getByText("Mali yazarkasa (ÖKC)")).toBeVisible();
});
