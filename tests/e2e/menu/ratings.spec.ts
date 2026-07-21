import { createHash } from "crypto";

import { expect, test } from "@playwright/test";

import { serviceRoleClient } from "../../helpers/testClients";
import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

test("S19: misafir oturum kapanınca değerlendirme ister; ≤3★ içeride kalır ve kaydedilir", async ({ browser, baseURL }) => {
  // Personel (owner/kasa) ve misafir aynı origin'i (acme.localhost) paylaştığı
  // için TEK bir browser context kullanılırsa misafirin anonim girişi
  // owner'ın oturum çerezini ezer — her aktör ayrı context'te izole edilir
  // (waiter-call-realtime.spec.ts ile aynı desen).
  const ownerContext = await browser.newContext();
  const page = await ownerContext.newPage();
  await loginAsAcmeOwner(page, baseURL!);

  // Değerlendirmeyi etkinleştir (varsayılan kapalı — Faz 2'den).
  await page.goto(acmeUrl(baseURL!, "/admin/settings"));
  const ratingCard = page.locator('[data-slot="card"]').filter({ hasText: "Değerlendirme" }).first();
  const enableSwitch = ratingCard.locator('[data-slot="switch"]');
  if ((await enableSwitch.getAttribute("aria-checked")) !== "true") {
    await enableSwitch.click();
  }
  await ratingCard.locator("#google-review-url").fill("https://example.com/google-review");
  await ratingCard.getByRole("button", { name: "Kaydet" }).click();
  await page.waitForLoadState("networkidle");

  // Kendine ait, çakışmasız yeni bir masa oluşturulur (table-qr-flow.spec.ts deseni).
  await page.goto(acmeUrl(baseURL!, "/admin/tables"));
  const tableLabel = `Rating Masa ${Date.now()}`;
  await page.getByLabel("Masa adı").fill(tableLabel);
  await page.getByRole("button", { name: "+ Masa Ekle" }).click();
  await expect(page.getByText(tableLabel).first()).toBeVisible();
  const urlText = await page.locator("p.break-all").textContent();
  const guestUrl = urlText!.trim();
  await page.getByRole("button", { name: "Kapat" }).click();

  // Misafir ayrı bir context'te masaya bağlanır, sipariş verir.
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.goto(guestUrl);
  await expect(guestPage).toHaveURL(/\/masa$/);
  const coffeeCard = guestPage.locator('[data-slot="card"]').filter({ hasText: "Filtre Kahve" });
  await coffeeCard.getByRole("button", { name: "Sepete ekle" }).click();
  await guestPage.getByRole("button", { name: "Siparişi Gönder" }).click();
  await expect(guestPage.getByText("Siparişiniz alındı.")).toBeVisible({ timeout: 10_000 });

  // Kasadan (owner) hesap ödenir → oturum kapanır.
  await page.goto(acmeUrl(baseURL!, "/cashier/pay"));
  await page.getByRole("button", { name: tableLabel }).click();
  await page.getByRole("button", { name: "Ödemeye Başla" }).click();
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page.getByText("Tüm paylar ödendi, hesap kapandı.")).toBeVisible();

  // Misafir tarafında oturum kapanışı poll ile algılanır, değerlendirme modalı çıkar.
  await expect(guestPage.getByText("Deneyiminizi değerlendirin")).toBeVisible({ timeout: 15_000 });
  await guestPage.getByRole("button", { name: "3 yıldız" }).click();
  await guestPage.getByRole("button", { name: "Gönder" }).click();

  // ≤3★ hiçbir koşulda Google'a yönlendirmez (RULES #30) — modal kapanır, sayfa /masa'da kalır.
  await expect(guestPage.getByText("Deneyiminizi değerlendirin")).not.toBeVisible();
  await expect(guestPage).toHaveURL(/\/masa$/);

  const service = serviceRoleClient();
  const { data: table } = await service
    .from("tables")
    .select("id")
    .eq("qr_token_hash", createHash("sha256").update(new URL(guestUrl).pathname.split("/").pop()!).digest("hex"))
    .maybeSingle();
  const { data: session } = await service
    .from("table_sessions")
    .select("id")
    .eq("table_id", table!.id)
    .order("opened_at", { ascending: false })
    .limit(1)
    .single();
  const { data: rating } = await service.from("ratings").select("stars").eq("table_session_id", session!.id).single();
  expect(rating?.stars).toBe(3);
});
