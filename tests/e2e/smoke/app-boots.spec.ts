import { expect, test } from "@playwright/test";

// D88: kök domainde tenant teması geçerli DEĞİL — pazarlama kendi token
// katmanını (2a) kullanır. Eskiden bu test görünür bir `warm-luxury` rozetini
// doğruluyordu; o rozet bir debug artefaktıydı ve canlı pazarlama sayfasında
// duruyordu, kaldırıldı. Assertion tema anahtarından YÜZEYE daraltıldı —
// anlamlı sözleşme bu.
test("kök domain marketing sayfasını pazarlama yüzeyiyle açar", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner").getByText("RKYS Dashboard")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-surface", "marketing");
});

test("bilinmeyen subdomain tenant-not-found sayfasına düşer", async ({ page, baseURL }) => {
  const url = new URL(baseURL!);
  url.hostname = `ghost.${url.hostname}`;
  await page.goto(url.toString());
  // GÜNCELLENDİ 2026-08-04: beklenen metin "Tenant bulunamadı." idi ama
  // sayfa "İşletme bulunamadı." yazıyor — i18n dizesi misafire dönük
  // Türkçeye çevrilirken değişmiş, spec eskimişti (RULES #11: metin
  // i18n'den gelir). Doğrulanan davranış aynı: bilinmeyen/askıya alınmış
  // tenant için "bulunamadı" sayfası.
  await expect(page.getByText("İşletme bulunamadı.")).toBeVisible();
});

test("/api/health 200 döner", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe("ok");
});

test("korumalı /admin route'u girişsiz login'e yönlendirir", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});
