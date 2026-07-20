import { expect, test } from "@playwright/test";

test("kök domain marketing sayfasını warm-luxury temasıyla açar", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("RKYS Dashboard")).toBeVisible();
  await expect(page.getByText("warm-luxury")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "warm-luxury");
});

test("bilinmeyen subdomain tenant-not-found sayfasına düşer", async ({ page, baseURL }) => {
  const url = new URL(baseURL!);
  url.hostname = `ghost.${url.hostname}`;
  await page.goto(url.toString());
  await expect(page.getByText("Tenant bulunamadı.")).toBeVisible();
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
