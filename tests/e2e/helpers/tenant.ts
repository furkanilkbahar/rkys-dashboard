import { expect, type Page } from "@playwright/test";

export function tenantUrl(baseURL: string, subdomain: string, path: string): string {
  const url = new URL(baseURL);
  url.hostname = `${subdomain}.${url.hostname}`;
  url.pathname = path;
  return url.toString();
}

export function acmeUrl(baseURL: string, path: string): string {
  return tenantUrl(baseURL, "acme", path);
}

export function betaUrl(baseURL: string, path: string): string {
  return tenantUrl(baseURL, "beta", path);
}

export async function loginAsAcmeOwner(page: Page, baseURL: string) {
  await page.goto(acmeUrl(baseURL, "/admin/login"));
  await page.getByLabel("E-posta").fill("owner@acme.test");
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/admin$/);
}

export async function loginAsAcmeManager(page: Page, baseURL: string) {
  await page.goto(acmeUrl(baseURL, "/admin/login"));
  await page.getByLabel("E-posta").fill("manager@acme.test");
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/admin$/);
}

/**
 * Garson hesabıyla ADMIN paneline giriş. Garsonun kendi PIN oturumu (D87)
 * ayrıdır; bu yol, izin bayrağı kapılarını (RULES #41) admin yüzeyinde
 * doğrulamak için var — acme seed'inde garsonun `reports.revenue` izni yok,
 * manager'ın var.
 */
export async function loginAsAcmeWaiter(page: Page, baseURL: string) {
  await page.goto(acmeUrl(baseURL, "/admin/login"));
  await page.getByLabel("E-posta").fill("waiter@acme.test");
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/admin$/);
}

export async function loginAsBetaOwner(page: Page, baseURL: string) {
  await page.goto(betaUrl(baseURL, "/admin/login"));
  await page.getByLabel("E-posta").fill("owner@beta.test");
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/admin$/);
}

// Süper Admin kabuğu kök domain altında (subdomain'siz) yaşıyor — bkz.
// src/proxy.ts'in ROOT_DOMAIN erken çıkışı.
export async function loginAsPlatformAdmin(page: Page, baseURL: string) {
  await page.goto(`${baseURL}/platform/login`);
  await page.getByLabel("E-posta").fill("platform@rkys.test");
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/platform$/);
}

/**
 * `router.refresh()` yarışına dayanıklı gezinme.
 *
 * Server action'ları takip eden `router.refresh()` çağrıları, aksiyon
 * çözüldükten SONRA bir RSC navigasyonu başlatıyor. Test tam o sırada başka
 * bir sayfaya geçmeye çalışırsa Playwright "interrupted by another navigation"
 * ile düşer — mobile-safari'de tekrarlanabilir şekilde görüldü
 * (ingredients-recipe S34 ve waiter-pin-login D87).
 *
 * `networkidle` beklemesi bunu KAPATMAZ: yenileme, ağ boşaldıktan sonra
 * başlayabiliyor. Kesilme geçici bir durumdur ve `goto` yan etkisizdir, bu
 * yüzden doğru araç yeniden denemektir. Hedef sayfaya varılamazsa test yine
 * düşer — iddia zayıflamıyor.
 */
export async function gotoSettled(page: Page, url: string): Promise<void> {
  await expect(async () => {
    await page.goto(url);
  }).toPass({ timeout: 20_000 });
}
