import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

test("S7: kapalı modül nav'da görünmez ve route'a erişilemez, açılınca ikisi de geri gelir", async ({
  page,
  baseURL,
  isMobile,
}) => {
  await loginAsAcmeOwner(page, baseURL!);

  // Önceki başarısız bir koşum temizlik adımına ulaşamamışsa modül açık
  // kalmış olabilir — teste bilinen bir başlangıç durumundan (kapalı) emin
  // olunarak başlanır (self-healing, DB'ye doğrudan erişim yerine UI üzerinden).
  await page.goto(acmeUrl(baseURL!, "/admin/settings"));
  const setupModulesCard = page.locator('[data-slot="card"]').filter({ hasText: "Modüller" });
  const setupSwitch = setupModulesCard.getByText("Rezervasyon", { exact: true }).locator("..").getByRole("switch");
  if ((await setupSwitch.getAttribute("aria-checked")) === "true") {
    await setupSwitch.click();
    await page.waitForLoadState("networkidle");
  }

  // Masaüstü sidebar lg breakpoint altında bilerek gizli (admin-nav.spec.ts) —
  // mobilde nav çekmecesi her navigasyon sonrası kapanır, kontrolden önce
  // hamburger menüsü tekrar açılır.
  async function openMobileNavIfNeeded() {
    if (isMobile) {
      await page.getByRole("button", { name: "Menüyü aç" }).click();
    }
  }

  await openMobileNavIfNeeded();
  await expect(page.getByRole("link", { name: "Rezervasyon" })).toBeHidden();

  const blockedResponse = await page.goto(acmeUrl(baseURL!, "/admin/reservations"));
  expect(blockedResponse?.status()).toBe(404);

  await page.goto(acmeUrl(baseURL!, "/admin/settings"));
  const modulesCard = page.locator('[data-slot="card"]').filter({ hasText: "Modüller" });
  const reservationsRow = modulesCard.getByText("Rezervasyon", { exact: true }).locator("..");
  await reservationsRow.getByRole("switch").click();
  await page.waitForLoadState("networkidle");
  await page.reload();

  await openMobileNavIfNeeded();
  await expect(page.getByRole("link", { name: "Rezervasyon" })).toBeVisible();

  const allowedResponse = await page.goto(acmeUrl(baseURL!, "/admin/reservations"));
  expect(allowedResponse?.status()).toBe(200);

  // Diğer testleri etkilememek için modül tekrar kapatılır.
  await page.goto(acmeUrl(baseURL!, "/admin/settings"));
  const modulesCardAgain = page.locator('[data-slot="card"]').filter({ hasText: "Modüller" });
  const reservationsRowAgain = modulesCardAgain.getByText("Rezervasyon", { exact: true }).locator("..");
  await reservationsRowAgain.getByRole("switch").click();
  await page.waitForLoadState("networkidle");
});
