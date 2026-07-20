import { expect, test } from "@playwright/test";

import { acmeUrl } from "../helpers/tenant";

test("misafirin garson çağrısı garson panelinde canlı görünür ve karşılanabilir", async ({ browser, baseURL }) => {
  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await staffPage.goto(acmeUrl(baseURL!, "/admin/login"));
  await staffPage.getByLabel("E-posta").fill("owner@acme.test");
  await staffPage.getByLabel("Şifre").fill("password123");
  await staffPage.getByRole("button", { name: "Giriş yap" }).click();
  await staffPage.waitForURL(/\/admin$/);
  await staffPage.goto(acmeUrl(baseURL!, "/waiter"));

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.goto(acmeUrl(baseURL!, "/masa/t/demo-acme-table-3"));
  await expect(guestPage).toHaveURL(/\/masa$/);

  await guestPage.getByRole("button", { name: "Garson Çağır" }).click();
  await guestPage.getByText("Su İstiyorum").click();
  await expect(guestPage.getByText("Garson çağrıldı.")).toBeVisible();

  // Realtime + otomatik yenileme ile garson panelinde belirir (Masa 3 — bu
  // testin kendi masası, önceki koşumlardan kalan başka açık çağrılar olsa
  // bile bununla karışmaz).
  const callCard = staffPage.locator('[data-slot="card"]').filter({ hasText: "Masa 3" }).first();
  await expect(callCard).toBeVisible({ timeout: 15_000 });
  await expect(callCard.getByText("Su İstiyorum")).toBeVisible();

  await callCard.getByRole("button", { name: "Karşılandı" }).click();
  await expect(callCard).toHaveCount(0, { timeout: 15_000 });

  await staffContext.close();
  await guestContext.close();
});
