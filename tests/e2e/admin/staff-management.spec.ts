import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

test("owner personel rolünü günceller, cihaz ekler ve izin bayrağını değiştirir", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);
  await page.goto(acmeUrl(baseURL!, "/admin/staff"));

  await expect(page.getByRole("heading", { name: "Personel" })).toBeVisible();

  // Waiter satırının Rozet No alanını güncelle.
  const badgeInputs = page.getByLabel("Rozet No");
  await badgeInputs.last().fill("W-99");
  await page.getByRole("button", { name: "Kaydet" }).last().click();
  await expect(page.getByText("Bu işlem için yetkiniz yok.")).toBeHidden();

  // Yetkili cihaz oluştur, bir kerelik şifre görünür.
  await page.getByLabel("Cihaz etiketi").fill("Test Cihazı");
  await page.getByRole("button", { name: "+ Cihaz Ekle" }).click();
  await expect(page.getByText("Cihaz Şifresi")).toBeVisible();
  await page.getByRole("button", { name: "Onayla" }).click();

  // İzin bayrağı matrisinde manager satırında bir switch'i aç/kapat.
  const permissionSwitches = page.locator("table").getByRole("switch");
  const firstSwitch = permissionSwitches.first();
  const before = await firstSwitch.getAttribute("aria-checked");
  await firstSwitch.click();
  await page.waitForLoadState("networkidle");
  await page.reload();
  const after = await permissionSwitches.first().getAttribute("aria-checked");
  expect(after).not.toBe(before);
});
