import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

// Aynı sabit lokal demo anahtarları — kitchen-station-filter.spec.ts deseni.
function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

const ACME_TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CREATED_CATEGORY_NAME = "Sıcak İçecekler";

// Bu dosya acme'nin GERÇEK demo kataloğuna kategori+ürün ekliyor ve eskiden
// hiç temizlemiyordu: her koşumda bir "Sıcak İçecekler" + "Espresso" daha
// birikiyordu. İki somut zarar ölçüldü — (1) demo menüsü tekrar eden
// kayıtlarla doluyordu, (2) `menu-reorder.spec.ts` biriken kategoriler
// yüzünden kırılıyordu (çöp silinince aynı test 2.4sn'de geçiyor).
// menu-reorder.integration.test.ts'teki afterAll temizliğiyle aynı gerekçe.
test.afterAll(async () => {
  const service = serviceClient();
  const { data: rows } = await service
    .from("content_translations")
    .select("entity_id")
    .eq("tenant_id", ACME_TENANT_ID)
    .eq("entity_type", "menu_category")
    .eq("field", "name")
    .eq("value", CREATED_CATEGORY_NAME);

  const ids = (rows ?? []).map((r) => r.entity_id);
  if (ids.length > 0) {
    // Ürün/varyant/ekstra kategoriye FK ile bağlı — cascade onları da alır.
    await service.from("menu_categories").delete().in("id", ids);
  }
});

test("owner kategori+ürün+varyant+ekstra oluşturup çeviri editörünü kullanabilir", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);

  await page.goto(acmeUrl(baseURL!, "/admin/menu/new"));
  await page.getByLabel("Ad (Türkçe)").first().fill("Sıcak İçecekler");
  await page.getByLabel("Ad (İngilizce)").first().fill("Hot Drinks");
  await page.getByRole("button", { name: "Kaydet" }).click();

  await expect(page).toHaveURL(/\/admin\/menu$/);
  await expect(page.getByText("Sıcak İçecekler").first()).toBeVisible();

  await page.getByText("Sıcak İçecekler").first().click();
  await expect(page).toHaveURL(/\/admin\/menu\/[^/]+$/);
  await expect(page.getByText("Kategoriyi Düzenle")).toBeVisible();

  await page.getByRole("button", { name: "+ Ürün Ekle" }).click();
  await expect(page).toHaveURL(/\/products\/new$/);
  await expect(page.getByText("Yeni Ürün")).toBeVisible();
  await page.getByLabel("Ad (Türkçe)").first().fill("Espresso");
  await page.getByLabel("Fiyat (₺)").fill("35.00");
  await page.getByRole("button", { name: "Kaydet" }).click();

  await expect(page).toHaveURL(/\/admin\/menu\/[^/]+$/);
  await expect(page.getByText("Espresso").first()).toBeVisible();
  await page.getByText("Espresso").first().click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await expect(page.getByText("Ürünü Düzenle")).toBeVisible();

  // Varyant ekle — "ekle" formu listede her zaman en sonda render edilir.
  const variantSection = page.getByTestId("variant-editor");
  await variantSection.getByPlaceholder("Ad (Türkçe)").last().fill("Tekli");
  await variantSection.getByPlaceholder("Fiyat (₺)").last().fill("35.00");
  await variantSection.getByRole("button", { name: "+ Varyant Ekle" }).click();
  await expect(variantSection.getByText("Varyant yok.")).toBeHidden();

  // Ekstra ekle
  const extraSection = page.getByTestId("extra-editor");
  await extraSection.getByPlaceholder("Ad (Türkçe)").last().fill("Ekstra Shot");
  await extraSection.getByPlaceholder("Fiyat (₺)").last().fill("10.00");
  await extraSection.getByRole("button", { name: "+ Ekstra Ekle" }).click();
  await expect(extraSection.getByText("Ekstra yok.")).toBeHidden();

  await page.reload();
  await expect(page.getByTestId("variant-editor").getByPlaceholder("Ad (Türkçe)").first()).toHaveValue("Tekli");
  await expect(page.getByTestId("extra-editor").getByPlaceholder("Ad (Türkçe)").first()).toHaveValue("Ekstra Shot");
});

test("waiter (menu.edit izni olmayan rol) kategori oluşturamaz", async ({ page, baseURL }) => {
  await page.goto(acmeUrl(baseURL!, "/admin/login"));
  await page.getByLabel("E-posta").fill("waiter@acme.test");
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/admin$/);

  await page.goto(acmeUrl(baseURL!, "/admin/menu/new"));
  await page.getByLabel("Ad (Türkçe)").first().fill("Yetkisiz Kategori");
  await page.getByRole("button", { name: "Kaydet" }).click();

  await expect(page.getByText("Bu işlem için yetkiniz yok.")).toBeVisible();
});
