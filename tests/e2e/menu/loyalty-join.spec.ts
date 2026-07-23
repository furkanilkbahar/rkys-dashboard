import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { tenantUrl } from "../helpers/tenant";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

async function createIsolatedTenantWithProduct() {
  const service = serviceClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const tableId = crypto.randomUUID();
  const subdomain = `test-loyalty-${suffix}`;
  const rawToken = `demo-loyalty-${suffix}`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Loyalty Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert({ tenant_id: tenantId, module_key: "crm_loyalty", is_enabled: true });
  await service.from("tenant_locales").insert({ tenant_id: tenantId, locale: "tr", is_default: true });

  const { createHash } = await import("crypto");
  await service.from("tables").insert({
    id: tableId, tenant_id: tenantId, branch_id: branchId, label: "Masa 1",
    qr_token_hash: createHash("sha256").update(rawToken).digest("hex"),
  });

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 5000, display_order: 0 });
  await service.from("content_translations").insert([
    { tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "tr", field: "name", value: "Filtre Kahve" },
    { tenant_id: tenantId, entity_type: "product", entity_id: productId, locale: "en", field: "name", value: "Filter Coffee" },
  ]);

  return { tenantId, subdomain, rawToken };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("S30: misafir telefon+OTP+KVKK ile sadakat programına katılır", async ({ page, baseURL }) => {
  const { tenantId, subdomain, rawToken } = await createIsolatedTenantWithProduct();
  try {
    await page.goto(tenantUrl(baseURL!, subdomain, `/masa/t/${rawToken}`));
    await expect(page).toHaveURL(/\/masa$/);

    const productCard = page.locator('[data-slot="card"]').filter({ hasText: "Filtre Kahve" });
    await productCard.getByRole("button", { name: "Sepete ekle" }).click();
    await page.getByRole("button", { name: "Siparişi Gönder" }).click();
    await expect(page.getByText("Siparişiniz alındı.")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Oturumum" }).click();
    await page.getByRole("button", { name: "Sadakat Programına Katıl" }).click();
    await page.getByPlaceholder("Telefon numarası").fill("+905551234567");
    await page.getByRole("button", { name: "Kod Gönder" }).click();

    const service = serviceClient();
    let code: string | undefined;
    await expect
      .poll(
        async () => {
          const { data } = await service.from("sent_sms").select("body").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1);
          code = data?.[0]?.body.match(/\d{6}/)?.[0];
          return code;
        },
        { timeout: 10_000 },
      )
      .toBeTruthy();

    await page.getByPlaceholder("Doğrulama kodu").fill(code!);
    await page.getByLabel(/kişisel verilerimin/i).check();
    await page.getByRole("button", { name: "Doğrula" }).click();
    await expect(page.getByText("Sadakat bakiyeniz: 0")).toBeVisible();

    const { data: customers } = await service.from("customers").select("id").eq("tenant_id", tenantId);
    expect(customers).toHaveLength(1);
  } finally {
    await deleteTenant(tenantId);
  }
});
