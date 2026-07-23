import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { tenantUrl } from "../helpers/tenant";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

const TEST_DATE = "2026-06-15";

async function createIsolatedTenantWithSales() {
  const service = serviceClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const subdomain = `test-menueng-${suffix}`;
  const email = `owner-menueng-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Menu Engineering Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });

  const categoryId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });

  const starProductId = crypto.randomUUID();
  await service.from("products").insert({ id: starProductId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 10000, display_order: 0 });
  await service.from("product_costs").insert({ product_id: starProductId, tenant_id: tenantId, cost_minor: 1000 });

  const dogProductId = crypto.randomUUID();
  await service.from("products").insert({ id: dogProductId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 2000, display_order: 1 });
  await service.from("product_costs").insert({ product_id: dogProductId, tenant_id: tenantId, cost_minor: 1800 });

  const tableId = crypto.randomUUID();
  await service.from("tables").insert({ id: tableId, tenant_id: tenantId, branch_id: branchId, label: "Masa 1", qr_token_hash: crypto.randomUUID() });
  const { data: session } = await service
    .from("table_sessions")
    .insert({ tenant_id: tenantId, branch_id: branchId, table_id: tableId, status: "active" })
    .select("id")
    .single();

  async function placeOrder(productId: string, name: string, quantity: number, unitPrice: number) {
    const orderId = crypto.randomUUID();
    await service.from("orders").insert({
      id: orderId, tenant_id: tenantId, branch_id: branchId, table_session_id: session!.id,
      status: "approved", subtotal_minor: unitPrice * quantity, channel: "dine_in", idempotency_key: crypto.randomUUID(),
    });
    await service.from("order_items").insert({
      tenant_id: tenantId, branch_id: branchId, table_session_id: session!.id, order_id: orderId, product_id: productId,
      product_name_snapshot: name, unit_price_minor: unitPrice, quantity, line_subtotal_minor: unitPrice * quantity,
      created_at: `${TEST_DATE}T12:00:00Z`,
    });
  }
  await placeOrder(starProductId, "Yıldız Ürün", 20, 10000);
  await placeOrder(dogProductId, "Zayıf Ürün", 2, 2000);

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  return { tenantId, subdomain, email };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("S37: menü mühendisliği matrisi dönem raporunda doğru kategorilerle görünür", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenantWithSales();
  try {
    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin$/);

    const reportsUrl = new URL(tenantUrl(baseURL!, subdomain, "/admin/reports"));
    reportsUrl.searchParams.set("periodStart", TEST_DATE);
    reportsUrl.searchParams.set("periodEnd", TEST_DATE);
    await page.goto(reportsUrl.toString());

    await expect(page.getByText("Menü Mühendisliği Matrisi")).toBeVisible();
    const starRow = page.getByText("Yıldız Ürün").locator("..");
    await expect(starRow.getByText("Yıldız — öne çıkar")).toBeVisible();
    const dogRow = page.getByText("Zayıf Ürün").locator("..");
    await expect(dogRow.getByText("Zayıf — menüden çıkarmayı düşün")).toBeVisible();
  } finally {
    await deleteTenant(tenantId);
  }
});
