import { expect, test } from "@playwright/test";

import { createThrowawayTenant, serviceRoleClient } from "../../helpers/testClients";
import { tenantUrl } from "../helpers/tenant";

// gamma (seed) yalnızca manuel/dev keşfi için tutulur — chromium-desktop ve
// mobile-safari AYNI yerel Supabase'e karşı çalıştığından, paylaşılan tek bir
// tenant'ın onboarding durumunu iki proje aynı anda değiştirirse çakışır
// (Adım 2'nin menu-reorder deneyimiyle aynı sınıf sorun). Bu yüzden her test
// kendi tek kullanımlık tenant'ını kurar.
async function loginToOnboarding(page: import("@playwright/test").Page, baseURL: string, slug: string, email: string) {
  await page.goto(tenantUrl(baseURL, slug, "/admin/login"));
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/admin\/onboarding$/);
}

test("S8: Sıfırdan kur — sihirbazın tüm adımları tamamlanınca dashboard açılır, guard bir daha sihirbaza yönlendirmez", async ({
  page,
  baseURL,
}) => {
  const throwaway = await createThrowawayTenant("e2e-fresh");

  await loginToOnboarding(page, baseURL!, throwaway.slug, throwaway.email);

  await expect(page.getByText("İşletmenizi kuralım")).toBeVisible();
  await page.getByRole("button", { name: "Sıfırdan kur" }).click();

  // Logo (opsiyonel, atlanır)
  await expect(page.getByText("Logo")).toBeVisible();
  await page.getByRole("button", { name: "İleri" }).click();

  // Diller
  await expect(page.getByText("Diller")).toBeVisible();
  await page.getByText("İngilizce", { exact: true }).locator("..").getByRole("switch").click();
  await page.getByRole("button", { name: "İleri" }).click();

  // Para birimi
  await expect(page.getByText("Para Birimi")).toBeVisible();
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "USD" }).click();
  await page.getByRole("button", { name: "İleri" }).click();

  // Masalar
  await expect(page.getByText("Masalar")).toBeVisible();
  await page.getByRole("button", { name: "Oluştur" }).click();
  await expect(page.getByRole("button", { name: "Masalar oluşturuldu" })).toBeVisible();
  await page.getByRole("button", { name: "İleri" }).click();

  // Şablon menü — 3 şablon kartından ilkini uygula
  await expect(page.getByText("Şablon Menü")).toBeVisible();
  await page.getByRole("button", { name: "Bu şablonu uygula" }).first().click();
  await expect(page.getByRole("button", { name: "Menü eklendi" })).toBeVisible();
  await page.getByRole("button", { name: "İleri" }).click();

  // Modül seçimi
  await expect(page.getByText("Modül Seçimi")).toBeVisible();
  await page.getByText("Rezervasyon", { exact: true }).locator("..").getByRole("switch").click();
  await page.getByRole("button", { name: "İleri" }).click();

  // Tema önizleme + tamamla
  await expect(page.getByText("Tema Önizleme")).toBeVisible();
  await page.getByRole("button", { name: "Tamamla" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: /Hoş geldin/ })).toBeVisible();

  // Guard: tamamlanmış onboarding'e tekrar girilemez, dashboard'a döner.
  await page.goto(tenantUrl(baseURL!, throwaway.slug, "/admin/onboarding"));
  await expect(page).toHaveURL(/\/admin$/);

  await serviceRoleClient().from("tenants").delete().eq("id", throwaway.tenantId);
});

test("S8: Demo veriyle keşfet — bir şablon seçilince onboarding tamamlanır", async ({ page, baseURL }) => {
  const throwaway = await createThrowawayTenant("e2e-explore");

  await loginToOnboarding(page, baseURL!, throwaway.slug, throwaway.email);

  await page.getByRole("button", { name: "Demo veriyle keşfet" }).click();
  await expect(page.getByText("Şablon Menü")).toBeVisible();
  await page.getByRole("button", { name: "Bu şablonu uygula" }).first().click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: /Hoş geldin/ })).toBeVisible();

  await page.goto(tenantUrl(baseURL!, throwaway.slug, "/admin/onboarding"));
  await expect(page).toHaveURL(/\/admin$/);

  await serviceRoleClient().from("tenants").delete().eq("id", throwaway.tenantId);
});
