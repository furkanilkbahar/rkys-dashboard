import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { betaUrl, loginAsBetaOwner } from "../helpers/tenant";

const BETA_TENANT_ID = "00000000-0000-4000-8000-000000000002";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

test("S16: admin para birimini değiştirir, misafir menüsü yeni birimle ve seçili dille görünür", async ({
  page,
  baseURL,
}) => {
  try {
    await loginAsBetaOwner(page, baseURL!);
    await page.goto(betaUrl(baseURL!, "/admin/settings"));

    const businessCard = page.locator('[data-slot="card"]').filter({ hasText: "İşletme Ayarları" });
    await businessCard.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "USD" }).click();
    await businessCard.getByRole("button", { name: "Kaydet" }).click();
    await page.waitForLoadState("networkidle");

    await page.goto(betaUrl(baseURL!, "/masa/t/demo-beta-table-1"));
    await expect(page.getByText("$150,00")).toBeVisible();

    // Faz 21: kategori adı artık İKİ yerde geçiyor — yeni yatay kategori
    // şeridinde (link) ve bölüm başlığında (heading). Metin değişmedi, DOM'a
    // brief'in (§2.2 kural 3) istediği şerit eklendi; locator anlamlı olana,
    // başlığa daraltıldı (Faz 19'da app-boots.spec.ts'e uygulanan aynı desen).
    await expect(page.getByRole("heading", { name: "Ana Yemekler" })).toBeVisible();
    await page.getByRole("button", { name: "EN" }).click();
    await expect(page.getByRole("heading", { name: "Main Courses" })).toBeVisible();
  } finally {
    // Para birimi `finally` içinde ve ARAYÜZ ÜZERİNDEN DEĞİL service-role ile
    // geri alınır — theme-switch.spec.ts'deki desenin aynısı.
    //
    // Eskiden geri alma testin gövdesindeydi ve ikinci bir admin girişi +
    // ayarlar formu sürüyordu. İki kusuru vardı: (1) test ortada düşerse hiç
    // çalışmıyordu ve beta USD'de KALIYORDU — paylaşılan seed tenant'ını
    // kirletmek D93'ün hijyen kuralının tam olarak yasakladığı şey, üstelik
    // sonraki koşumların beta'ya bakan spec'lerini de bozar; (2) o noktada
    // arayüz dili EN'e çevrilmiş oluyor, dolayısıyla Türkçe etiketlerle
    // yazılmış giriş akışı dile bağımlı hale geliyordu. DB'ye doğrudan yazmak
    // ikisini de ortadan kaldırır ve senaryonun kendisi değişmez.
    await serviceClient().from("tenants").update({ currency: "TRY" }).eq("id", BETA_TENANT_ID);
  }
});
