import { expect, test } from "@playwright/test";

import { createThrowawayTenant, serviceRoleClient } from "../../helpers/testClients";
import { tenantUrl } from "../helpers/tenant";

// S9: acme paylaşılan tenant'ı kullanılmaz — gün sonu kapanışı o şubede
// AYNI iş günü için sonraki tüm ödeme/kasa hareketini kalıcı olarak
// reddeder (RULES #36), bu yüzden diğer E2E dosyalarını (S18, S10/S11,
// S19, online-payment) bozmamak için tek kullanımlık bir tenant kurulur
// (onboarding.spec.ts ile aynı izolasyon deseni).
test("S9: kasa — vardiya aç → POS-lite sipariş → ödeme al → gün sonu sayım/fark raporu", async ({ page, baseURL }) => {
  const throwaway = await createThrowawayTenant("s9-day-close");
  const service = serviceRoleClient();

  await service.from("tenants").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", throwaway.tenantId);
  await service.from("tenant_modules").insert({ tenant_id: throwaway.tenantId, module_key: "pos_cash", is_enabled: true });
  await service.from("tenant_locales").insert({ tenant_id: throwaway.tenantId, locale: "tr", is_default: true });

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: throwaway.tenantId, layout: "grid", display_order: 0 });
  await service
    .from("products")
    .insert({ id: productId, tenant_id: throwaway.tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 5000, display_order: 0 });
  await service
    .from("content_translations")
    .insert({ tenant_id: throwaway.tenantId, entity_type: "product", entity_id: productId, locale: "tr", field: "name", value: "Test Kahve" });

  await page.goto(tenantUrl(baseURL!, throwaway.slug, "/admin/login"));
  await page.getByLabel("E-posta").fill(throwaway.email);
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // Vardiya aç.
  await page.goto(tenantUrl(baseURL!, throwaway.slug, "/cashier"));
  await page.getByLabel(/Açılış Bakiyesi/).fill("100");
  await page.getByRole("button", { name: "Vardiyayı Aç" }).click();
  await expect(page.getByText("Açık Vardiya")).toBeVisible();

  // POS-lite sipariş.
  await page.goto(tenantUrl(baseURL!, throwaway.slug, "/cashier/order"));
  await page.getByLabel("Masa Seç").click();
  await page.getByRole("option", { name: /Tezgâh/ }).click();
  const productRow = page.getByText("Test Kahve", { exact: true }).locator("../..");
  await productRow.getByRole("button", { name: "Siparişe Ekle" }).click();
  await page.getByRole("button", { name: "Siparişi Gönder" }).click();
  await expect(page.getByText("Sipariş gönderildi.")).toBeVisible();

  // Ödeme al.
  await page.goto(tenantUrl(baseURL!, throwaway.slug, "/cashier/pay"));
  await page.getByRole("button", { name: /Tezgâh/ }).click();
  await page.getByRole("button", { name: "Ödemeye Başla" }).click();
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page.getByText("Tüm paylar ödendi, hesap kapandı.")).toBeVisible();
  await page.waitForLoadState("networkidle");

  // Vardiyayı kapat: sayım/fark.
  await page.goto(tenantUrl(baseURL!, throwaway.slug, "/cashier"));
  await page.getByLabel("Sayılan Nakit").fill("150"); // 100 açılış + 50 satış beklenirdi → +0 fark
  await page.getByRole("button", { name: "Vardiyayı Kapat" }).click();
  await expect(page.getByText("Son Kapanan Vardiya")).toBeVisible();
  await expect(page.getByText("Beklenen: ₺150,00")).toBeVisible();
  await expect(page.getByText("Sayılan: ₺150,00")).toBeVisible();

  // Gün sonu raporu: ciro + en çok satan doğru görünür, gün kapatılabilir.
  await page.goto(tenantUrl(baseURL!, throwaway.slug, "/admin/reports"));
  await expect(page.getByText("Ciro: ₺50,00")).toBeVisible();
  await expect(page.getByText("Test Kahve").first()).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Günü Kapat" }).click();
  await expect(page.getByText("Bu iş günü kapatıldı.")).toBeVisible();
});
