import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { acmeUrl } from "../helpers/tenant";

// Sabit lokal demo anahtarları (gizli değil — .env.ci'de de aynı değerler
// committed). afterEach HER zaman çalışır (başarısız denemede de) — inline
// temizlik yalnızca test BAŞARILI olunca çalışırdı, bu da retry'larda aynı
// oturuma birden fazla sipariş birikmesine ve ".last()" seçicilerinin
// şaşırmasına yol açıyordu.
const ACME_TABLE_1_ID = "00000000-0000-4000-8000-000000000501";
const ACME_TABLE_4_ID = "00000000-0000-4000-8000-000000000505";

async function closeActiveSession(tableId: string) {
  const service = createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
  await service
    .from("table_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("table_id", tableId)
    .eq("status", "active");
}

test.afterEach(async () => {
  await closeActiveSession(ACME_TABLE_1_ID);
  await closeActiveSession(ACME_TABLE_4_ID);
});

test("müşteri oturum paneli siparişi + ara toplamı gösterir, hesap isteyebilir", async ({ page, baseURL }) => {
  await page.goto(acmeUrl(baseURL!, "/masa/t/demo-acme-table-1"));
  await expect(page).toHaveURL(/\/masa$/);

  const coffeeCard = page.locator('[data-slot="card"]').filter({ hasText: "Filtre Kahve" });
  await coffeeCard.getByRole("button", { name: "Sepete ekle" }).click();
  await page.getByRole("button", { name: "Siparişi Gönder" }).click();
  await expect(page.getByText("Siparişiniz alındı.")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Oturumum" }).click();
  // Sipariş sepetten gönderildikten sonra Realtime ile panel taze veriyi
  // çeker — bu yuvarlanış için biraz daha bol zaman tanınır.
  await expect(page.getByText(/Ara toplam: ₺80,00/)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Hesap İste" }).click();
  await expect(page.getByText("Hesap istendi")).toBeVisible({ timeout: 15_000 });
});

test("siparişi hazır olduğunda misafir bildirim görür (D33)", async ({ browser, baseURL }) => {
  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await staffPage.goto(acmeUrl(baseURL!, "/admin/login"));
  await staffPage.getByLabel("E-posta").fill("owner@acme.test");
  await staffPage.getByLabel("Şifre").fill("password123");
  await staffPage.getByRole("button", { name: "Giriş yap" }).click();
  await staffPage.waitForURL(/\/admin$/);

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.goto(acmeUrl(baseURL!, "/masa/t/demo-acme-table-4"));
  await expect(guestPage).toHaveURL(/\/masa$/);

  const coffeeCard = guestPage.locator('[data-slot="card"]').filter({ hasText: "Filtre Kahve" });
  await coffeeCard.getByRole("button", { name: "Sepete ekle" }).click();
  await guestPage.getByRole("button", { name: "Siparişi Gönder" }).click();
  await expect(guestPage.getByText("Siparişiniz alındı.")).toBeVisible({ timeout: 15_000 });

  await guestPage.getByRole("button", { name: "Oturumum" }).click();
  // Menüdeki statik "Filtre Kahve" ürün kartıyla karışmasın diye sipariş
  // kartı yalnızca oturum paneli container'ı İÇİNDE aranır.
  const orderCard = guestPage.getByTestId("session-orders-panel").locator('[data-slot="card"]').last();

  await staffPage.goto(acmeUrl(baseURL!, "/kitchen"));
  // afterEach her koşumdan sonra oturumu kapattığı için burada her zaman
  // yalnızca BU testin ürettiği tek bir "Masa 4" kartı olur.
  const kdsCard = staffPage.locator('[data-slot="card"]').filter({ hasText: "Masa 4" }).last();
  await expect(kdsCard).toBeVisible({ timeout: 15_000 });
  await kdsCard.getByRole("button", { name: "Hazırlamaya Başla" }).click();
  await expect(kdsCard.getByRole("button", { name: "Hazır", exact: true })).toBeVisible({ timeout: 15_000 });
  await kdsCard.getByRole("button", { name: "Hazır", exact: true }).click();

  await expect(guestPage.getByText("Siparişiniz hazır!")).toBeVisible({ timeout: 15_000 });
  await expect(orderCard.getByText("Hazır")).toBeVisible({ timeout: 15_000 });

  await staffContext.close();
  await guestContext.close();
});
