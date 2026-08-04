import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

test("girişsiz ziyaretçi /admin'e girince login'e yönlenir", async ({ page, baseURL }) => {
  await page.goto(acmeUrl(baseURL!, "/admin"));
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("owner girişiyle admin nav kabuğu görünür ve bölümler arası geçiş çalışır", async ({ page, baseURL, isMobile }) => {
  test.skip(isMobile, "Masaüstü sidebar lg breakpoint altında bilerek gizli — mobil nav ayrı testte kapsanıyor.");
  await loginAsAcmeOwner(page, baseURL!);

  // `exact: true` (2026-08-04): getByRole ERİŞİLEBİLİR ADI varsayılan olarak
  // büyük/küçük harf duyarsız ALT DİZE eşler. Faz 23'te panoya hızlı işlem
  // bağlantıları gelince ("Menüyü düzenle", "Personeli yönet", "Raporları
  // aç") gevşek eşleşme sidebar nav'ıyla çakıştı. Kastedilen her zaman
  // sidebar'daki TAM adlı bağlantıydı; locator artık onu söylüyor.
  // (D90'da masa adlarında belgelenen tuzağın aynısı.)
  await expect(page.getByRole("heading", { name: /Hoş geldin/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Menü", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Masalar", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Personel", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ayarlar", exact: true })).toBeVisible();

  // Personel Adım 5'ten beri gerçek içerik (nav geçişini bu bölümle
  // doğruluyoruz; Menü Adım 1'den, Masalar Adım 4'ten beri gerçek içerik,
  // kendi testleri menu-crud.spec.ts / table-qr-flow.spec.ts'te).
  await page.getByRole("link", { name: "Personel", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/staff$/);
  await expect(page.getByText("İzin Bayrakları")).toBeVisible();
});

test("çıkış yap admin oturumunu kapatır", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);

  // GÜNCELLENDİ 2026-08-04: bu locator Faz 21'den beri kırıktı. Üst bardaki
  // hesap düğmesi eskiden ROLÜ ("owner") yazıyordu; yeniden tasarımda
  // işletme adını yazar oldu ve rol açılır menünün içine bir etiket olarak
  // taşındı (admin-shell.tsx). Test 45sn boyunca var olmayan bir düğmeyi
  // bekliyordu. Doğrulanan davranış aynı: menüden çıkış yapılır.
  await page.getByRole("button", { name: "Acme Kafe" }).click();
  await page.getByText("Çıkış yap").click();

  await expect(page).toHaveURL(/\/admin\/login$/);

  await page.goto(acmeUrl(baseURL!, "/admin"));
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("mobil görünümde hamburger menüsü nav çekmecesini açar", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAsAcmeOwner(page, baseURL!);

  await expect(page.getByRole("link", { name: "Menü", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Menüyü aç" }).click();
  await expect(page.getByRole("link", { name: "Menü", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Masalar", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/tables$/);
});
