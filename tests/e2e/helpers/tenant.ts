import type { Page } from "@playwright/test";

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
