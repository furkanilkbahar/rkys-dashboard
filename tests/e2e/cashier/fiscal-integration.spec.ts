import { expect, test } from "@playwright/test";

import { createThrowawayTenant, serviceRoleClient } from "../../helpers/testClients";
import { tenantUrl } from "../helpers/tenant";

test("S67: ÖKC modülü açıkken ödeme alınınca mock fiş kesilir ve ayarlarda özet görünür", async ({ page, baseURL }) => {
  const throwaway = await createThrowawayTenant("s67-fiscal");
  const service = serviceRoleClient();

  try {
    await service.from("tenants").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", throwaway.tenantId);
    await service.from("tenant_modules").insert([
      { tenant_id: throwaway.tenantId, module_key: "pos_cash", is_enabled: true },
      { tenant_id: throwaway.tenantId, module_key: "fiscal_integration", is_enabled: true },
    ]);
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

    await page.goto(tenantUrl(baseURL!, throwaway.slug, "/cashier"));
    await page.getByLabel(/Açılış Bakiyesi/).fill("0");
    await page.getByRole("button", { name: "Vardiyayı Aç" }).click();
    await expect(page.getByText("Açık Vardiya")).toBeVisible();

    await page.goto(tenantUrl(baseURL!, throwaway.slug, "/cashier/order"));
    await page.getByLabel("Masa Seç").click();
    await page.getByRole("option", { name: /Tezgâh/ }).click();
    const productRow = page.getByText("Test Kahve", { exact: true }).locator("../..");
    await productRow.getByRole("button", { name: "Siparişe Ekle" }).click();
    await page.getByRole("button", { name: "Siparişi Gönder" }).click();
    await expect(page.getByText("Sipariş gönderildi.")).toBeVisible();

    await page.goto(tenantUrl(baseURL!, throwaway.slug, "/cashier/pay"));
    await page.getByRole("button", { name: /Tezgâh/ }).click();
    await page.getByRole("button", { name: "Ödemeye Başla" }).click();
    await page.getByRole("button", { name: "Öde" }).click();
    await expect(page.getByText("Tüm paylar ödendi, hesap kapandı.")).toBeVisible();
    await page.waitForLoadState("networkidle");

    // TS katmanındaki best-effort fiş kesimi: payments RPC (DB) ile aynı
    // istek içinde ama ayrı bir adımda çalışıyor — DB'ye yazılana kadar kısa
    // bir poll (bkz. bu oturumdaki kurye konum testinde de kullanılan desen).
    await expect
      .poll(
        async () => {
          const { data } = await service.from("fiscal_receipts").select("id").eq("tenant_id", throwaway.tenantId);
          return data?.length ?? 0;
        },
        { timeout: 10_000 },
      )
      .toBe(1);

    await page.goto(tenantUrl(baseURL!, throwaway.slug, "/admin/settings"));
    await expect(page.getByText("Bugün 1 fiş kesildi")).toBeVisible();
    await expect(page.getByText("₺50,00")).toBeVisible();
  } finally {
    await service.from("tenants").delete().eq("id", throwaway.tenantId);
  }
});
