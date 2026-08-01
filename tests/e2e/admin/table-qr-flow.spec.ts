import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

test("owner masa oluşturup QR'ı gösterebilir, üretilen token misafir akışında çalışır", async ({
  page,
  context,
  baseURL,
}) => {
  await loginAsAcmeOwner(page, baseURL!);
  await page.goto(acmeUrl(baseURL!, "/admin/tables"));

  const tableLabel = `Test Masa ${Date.now()}`;
  await page.getByLabel("Masa adı").fill(tableLabel);
  await page.getByRole("button", { name: "+ Masa Ekle" }).click();

  await expect(page.getByText(tableLabel).first()).toBeVisible();
  await expect(page.getByText("PNG İndir")).toBeVisible();

  const urlText = await page.locator("p.break-all").textContent();
  expect(urlText).toBeTruthy();
  const guestUrl = urlText!.trim();

  await page.getByRole("button", { name: "Kapat" }).click();

  // Üretilen QR URL'sini gerçek bir misafir olarak ziyaret et — admin
  // panelinden oluşturulan token'ın Faz 1 misafir akışıyla uçtan uca
  // çalıştığını doğrular.
  const guestPage = await context.newPage();
  await guestPage.goto(guestUrl);
  await expect(guestPage).toHaveURL(/\/masa$/);
  await expect(guestPage.getByText("Filtre Kahve")).toBeVisible();
});

test("bug-hunt 2026-08-01: owner masayı pasife alıp tekrar aktifleştirebilir (silme yerine arşivleme)", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);
  await page.goto(acmeUrl(baseURL!, "/admin/tables"));

  const tableLabel = `Arşiv Masa ${Date.now()}`;
  await page.getByLabel("Masa adı").fill(tableLabel);
  await page.getByRole("button", { name: "+ Masa Ekle" }).click();
  await expect(page.getByText(tableLabel).first()).toBeVisible();
  await page.getByRole("button", { name: "Kapat" }).click();

  const row = page.locator('[data-testid^="table-row-"]').filter({ hasText: tableLabel });
  await expect(row.getByText("Aktif", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await row.getByRole("button", { name: "Pasife Al" }).click();
  await expect(row.getByText("Aktif", { exact: true })).toBeHidden({ timeout: 10_000 });

  await row.getByRole("button", { name: "Aktifleştir" }).click();
  await expect(row.getByText("Aktif", { exact: true })).toBeVisible({ timeout: 10_000 });
});

test("bug-hunt 2026-08-01: QR Göster — QR_TOKEN_ENCRYPTION_KEY ayarlı değilken anlaşılır bir hata gösterir, mevcut QR'ı bozmaz", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);
  await page.goto(acmeUrl(baseURL!, "/admin/tables"));

  const tableLabel = `QR Goster Masa ${Date.now()}`;
  await page.getByLabel("Masa adı").fill(tableLabel);
  await page.getByRole("button", { name: "+ Masa Ekle" }).click();
  await expect(page.getByText(tableLabel).first()).toBeVisible();
  await page.getByRole("button", { name: "Kapat" }).click();

  const row = page.locator('[data-testid^="table-row-"]').filter({ hasText: tableLabel });
  await row.getByRole("button", { name: "QR Göster" }).click();
  // Bu ortamda QR_TOKEN_ENCRYPTION_KEY henüz ayarlanmadığı için (bkz. D86)
  // şifreli kopya hiç saklanmadı — "göster" nazikçe hata vermeli, sessizce
  // hiçbir şey yapmamalı ya da çökmemeli. Anahtar eklenince bu senaryo
  // (yeni oluşturulan QR'lar için) gerçek gösterime döner.
  await expect(page.getByText("Bu QR tekrar gösterilemiyor")).toBeVisible();

  // QR Yenile ayrı, bozulmadan çalışmaya devam etmeli.
  page.once("dialog", (dialog) => void dialog.accept());
  await row.getByRole("button", { name: "QR'ı Yenile" }).click();
  await expect(page.getByText("PNG İndir")).toBeVisible();
});
