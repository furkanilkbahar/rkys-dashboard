import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

// "Masa 4" yalnızca E2E test izolasyonu için ayrılmış (bkz. seed.sql) — bu
// testin kendi oturumu dışında hiçbir şey kullanmaz.
async function closeActiveSessionForTable4() {
  const service = serviceClient();
  const { data: table } = await service.from("tables").select("id").eq("label", "Masa 4").limit(1).maybeSingle();
  if (!table) return;
  await service.from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("table_id", table.id).eq("status", "active");
}

test.afterEach(async () => {
  await closeActiveSessionForTable4();
});

test("bug-hunt 2026-08-01: masa ödemesi tamamlanınca garson paneline ödeme yöntemi bildirimi düşer", async ({ browser, baseURL }) => {
  const cashierContext = await browser.newContext();
  const cashierPage = await cashierContext.newPage();
  const waiterContext = await browser.newContext();
  const waiterPage = await waiterContext.newPage();
  try {
    await loginAsAcmeOwner(cashierPage, baseURL!);
    await loginAsAcmeOwner(waiterPage, baseURL!);
    await waiterPage.goto(acmeUrl(baseURL!, "/waiter"));

    await cashierPage.goto(acmeUrl(baseURL!, "/cashier/order"));
    await cashierPage.getByLabel("Masa Seç").click();
    await cashierPage.getByRole("option", { name: "Masa 4" }).click();
    const coffeeRow = cashierPage.getByText("Filtre Kahve", { exact: true }).locator("../..");
    await coffeeRow.getByRole("button", { name: "Siparişe Ekle" }).click();
    await cashierPage.getByRole("button", { name: "Siparişi Gönder" }).click();
    await expect(cashierPage.getByText("Sipariş gönderildi.")).toBeVisible();

    await cashierPage.goto(acmeUrl(baseURL!, "/cashier/pay"));
    await cashierPage.getByRole("button", { name: /Masa 4/ }).click();
    await cashierPage.getByRole("button", { name: "Ödemeye Başla" }).click();
    // Varsayılan: bölüşme yok (1 pay), yöntem 'cash' — tek "Öde" tıklaması
    // tüm hesabı nakit olarak kapatır.
    await cashierPage.getByRole("button", { name: "Öde" }).click();
    await expect(cashierPage.getByText("Tüm paylar ödendi, hesap kapandı.")).toBeVisible();

    await expect(waiterPage.getByText("Masa 4 — Nakit ile ödendi")).toBeVisible({ timeout: 15_000 });
  } finally {
    await cashierContext.close();
    await waiterContext.close();
  }
});
