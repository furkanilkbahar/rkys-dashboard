import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { tenantUrl } from "../helpers/tenant";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

async function createIsolatedTenantWithZone() {
  const service = serviceClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const subdomain = `test-delivery-${suffix}`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Delivery Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert({ tenant_id: tenantId, module_key: "delivery", is_enabled: true });
  await service.from("tenant_locales").insert({ tenant_id: tenantId, locale: "tr", is_default: true });
  await service.from("delivery_zones").insert({ tenant_id: tenantId, branch_id: branchId, name: "Merkez", fee_minor: 1000, min_basket_minor: 0 });

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 5000, display_order: 0 });
  await service.from("content_translations").insert([
    { tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "tr", field: "name", value: "Pizza" },
    { tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "en", field: "name", value: "Pizza" },
  ]);

  return { tenantId, subdomain };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("S39: misafir bölge seçip adres girerek paket servis siparişi verir, ücret toplama eklenir", async ({ page, baseURL }) => {
  const { tenantId, subdomain } = await createIsolatedTenantWithZone();
  try {
    await page.goto(tenantUrl(baseURL!, subdomain, "/teslimat/baslat"));
    await expect(page).toHaveURL(/\/teslimat$/);

    const productCard = page.locator('[data-slot="card"]').filter({ hasText: "Pizza" });
    await productCard.getByRole("button", { name: "Sepete ekle" }).click();

    await page.getByRole("combobox", { name: "Teslimat Bölgesi" }).click();
    await page.getByRole("option", { name: /Merkez/ }).click();
    await page.getByLabel("Teslimat Adresi").fill("Test Mahallesi No:5");
    await page.getByRole("button", { name: "Siparişi Gönder" }).click();
    await expect(page.getByText("Siparişiniz alındı.")).toBeVisible({ timeout: 15_000 });

    const service = serviceClient();
    const { data: order } = await service
      .from("orders")
      .select("channel, subtotal_minor, delivery_fee_minor, delivery_address_snapshot")
      .eq("tenant_id", tenantId)
      .single();
    expect(order).toEqual({
      channel: "delivery",
      subtotal_minor: 6000,
      delivery_fee_minor: 1000,
      delivery_address_snapshot: "Test Mahallesi No:5",
    });
  } finally {
    await deleteTenant(tenantId);
  }
});
