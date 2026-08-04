import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

test("owner masa oluşturup QR'ı gösterebilir, üretilen token misafir akışında çalışır", async ({
  page,
  context,
  baseURL,
}) => {
  await loginAsAcmeOwner(page, baseURL!);
  await page.goto(acmeUrl(baseURL!, "/admin/tables"));
  // WebKit hidrasyon yarışı (PLAN.md Faz 21 takip maddesi 2): "+ Masa Ekle"
  // react-hook-form + server action ile çalışıyor, hidrasyon bitmeden
  // yapılan tıklama sessizce yutuluyor. Faz 23'te liste tabloya alınıp
  // sayfa ağırlaşınca pencere büyüdü; `networkidle` chunk'ları bekletir.
  await page.waitForLoadState("networkidle");

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
  // Başlık rolüyle daraltıldı (2026-08-04): Faz 22'de ürün açıklamaları
  // eklenince `getByText("Filtre Kahve")` iki öğeye düştü — ürünün ADI (h3)
  // ve AÇIKLAMASI ("...günlük demlenen filtre kahve."), çünkü getByText
  // varsayılan olarak büyük/küçük harf duyarsız ALT DİZE eşler. Bir menü
  // açıklamasının ürünün adını tekrar etmesi doğal; düzeltilmesi gereken
  // gerçek içerik değil, fazla geniş locator'dı. Doğrulanan davranış aynı:
  // admin'de üretilen token misafir menüsünü açıyor.
  await expect(guestPage.getByRole("heading", { name: "Filtre Kahve" })).toBeVisible();
});

test("bug-hunt 2026-08-01: owner masayı pasife alıp tekrar aktifleştirebilir (silme yerine arşivleme)", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);
  await page.goto(acmeUrl(baseURL!, "/admin/tables"));
  // WebKit hidrasyon yarışı (PLAN.md Faz 21 takip maddesi 2): "+ Masa Ekle"
  // react-hook-form + server action ile çalışıyor, hidrasyon bitmeden
  // yapılan tıklama sessizce yutuluyor. Faz 23'te liste tabloya alınıp
  // sayfa ağırlaşınca pencere büyüdü; `networkidle` chunk'ları bekletir.
  await page.waitForLoadState("networkidle");

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

test("QR Göster mevcut QR'ı tekrar gösterir ve QR'ı Yenile'yi bozmaz", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);
  await page.goto(acmeUrl(baseURL!, "/admin/tables"));
  // WebKit hidrasyon yarışı (PLAN.md Faz 21 takip maddesi 2): "+ Masa Ekle"
  // react-hook-form + server action ile çalışıyor, hidrasyon bitmeden
  // yapılan tıklama sessizce yutuluyor. Faz 23'te liste tabloya alınıp
  // sayfa ağırlaşınca pencere büyüdü; `networkidle` chunk'ları bekletir.
  await page.waitForLoadState("networkidle");

  const tableLabel = `QR Goster Masa ${Date.now()}`;
  await page.getByLabel("Masa adı").fill(tableLabel);
  await page.getByRole("button", { name: "+ Masa Ekle" }).click();
  await expect(page.getByText(tableLabel).first()).toBeVisible();
  await page.getByRole("button", { name: "Kapat" }).click();

  const row = page.locator('[data-testid^="table-row-"]').filter({ hasText: tableLabel });
  await row.getByRole("button", { name: "QR Göster" }).click();
  // GÜNCELLENDİ 2026-08-04: bu test yazıldığında QR_TOKEN_ENCRYPTION_KEY
  // ayarlı değildi ve "Bu QR tekrar gösterilemiyor" hata metnini bekliyordu.
  // Testin kendi yorumu bunu zaten öngörmüştü ("anahtar eklenince bu senaryo
  // gerçek gösterime döner"). Anahtar D86 ile eklendi, yani beklenen metin
  // artık hiç çıkmıyor — test bayat kaldığı için kırılıyordu, ürün değil.
  // Korunan davranış aynı: "QR Göster" çökmüyor ve "QR'ı Yenile"yi bozmuyor;
  // yalnızca doğru önkoşul altında doğru sonuç bekleniyor.
  await expect(page.getByText("PNG İndir")).toBeVisible();
  await page.getByRole("button", { name: "Kapat" }).click();

  // QR Yenile ayrı, bozulmadan çalışmaya devam etmeli.
  page.once("dialog", (dialog) => void dialog.accept());
  await row.getByRole("button", { name: "QR'ı Yenile" }).click();
  await expect(page.getByText("PNG İndir")).toBeVisible();
});
