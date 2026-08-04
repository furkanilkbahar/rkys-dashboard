import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

test("owner personel rolünü günceller, cihaz ekler ve izin bayrağını değiştirir", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);
  await page.goto(acmeUrl(baseURL!, "/admin/staff"));

  await expect(page.getByRole("heading", { name: "Personel" })).toBeVisible();

  // GÜNCELLENDİ 2026-08-04 (D94): personel listesi tabloya alındı ve
  // düzenleyici artık satırın ALTINA açılıyor — eskiden 8 personel 8 açık
  // form olarak duruyordu. Satır adıyla bulunuyor; ad kolonu 0091 ile geldi
  // (öncesinde satırların kimlik kolonu yoktu).
  const waiterRow = page.locator('[data-testid^="staff-row-"]').filter({ hasText: "Kerem Yıldız" });
  await waiterRow.getByRole("button", { name: "Düzenle" }).click();

  const editor = page.locator("tr[data-expansion]");
  await editor.getByLabel("Rozet No").fill("W-99");
  await editor.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Bu işlem için yetkiniz yok.")).toBeHidden();
  await expect(waiterRow.getByText("W-99")).toBeVisible();

  // Yetkili cihaz oluştur, bir kerelik şifre görünür.
  await page.getByLabel("Cihaz etiketi").fill("Test Cihazı");
  await page.getByRole("button", { name: "+ Cihaz Ekle" }).click();
  await expect(page.getByText("Cihaz Şifresi")).toBeVisible();
  await page.getByRole("button", { name: "Onayla" }).click();

  // İzin bayrağı matrisinde manager satırında bir switch'i aç/kapat.
  // Kart ile kapsandı (2026-08-04): sayfada artık üç `<table>` var (personel,
  // cihazlar, izin matrisi) ve personel düzenleyicisi de bir switch içeriyor;
  // `page.locator("table")` tek başına yanlış switch'i seçebilirdi.
  const permissionCard = page.locator('[data-slot="card"]').filter({ hasText: "İzin Bayrakları" });
  const permissionSwitches = permissionCard.getByRole("switch");
  const firstSwitch = permissionSwitches.first();
  const before = await firstSwitch.getAttribute("aria-checked");
  await firstSwitch.click();
  await page.waitForLoadState("networkidle");
  await page.reload();
  const after = await permissionSwitches.first().getAttribute("aria-checked");
  expect(after).not.toBe(before);
});
