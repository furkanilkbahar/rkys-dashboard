import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { tenantUrl } from "../helpers/tenant";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

async function createIsolatedTenant() {
  const service = serviceClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const subdomain = `test-accounting-${suffix}`;
  const email = `owner-accounting-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Accounting Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert([
    { tenant_id: tenantId, module_key: "accounting_export", is_enabled: true },
    { tenant_id: tenantId, module_key: "pos_cash", is_enabled: true },
  ]);

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  await service.from("menu_categories").insert({ id: categoryId, tenant_id: tenantId, layout: "grid", display_order: 0 });
  await service.from("products").insert({ id: productId, tenant_id: tenantId, category_id: categoryId, track_mode: "simple", base_price_minor: 2500, display_order: 0 });
  const { data: counterTable } = await service.from("tables").select("id").eq("tenant_id", tenantId).eq("is_counter", true).single();

  const owner = createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  );
  await owner.auth.signInWithPassword({ email, password: "password123" });
  const { data: order } = await owner.rpc("submit_staff_order", { p_table_id: counterTable!.id, p_items: [{ productId, variantId: null, quantity: 1, extraIds: [] }] });
  await service.from("orders").update({ status: "served" }).eq("id", order![0].order_id);

  return { tenantId, subdomain, email };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("S44: admin tamamlanmış siparişi muhasebeye gönderir, geçmişte görünür ve gönderilecekler listesinden düşer", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenant();
  try {
    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin$/);

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/accounting"));
    await expect(page.getByText("dine_in")).toBeVisible();

    await page.getByRole("button", { name: "Muhasebeye Gönder" }).click();
    await expect(page.getByText(/Başarılı — mock-inv-/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Gönderilecek sipariş yok.")).toBeVisible();

    const service = serviceClient();
    const { data: log } = await service.from("accounting_sync_log").select("status, external_ref").eq("tenant_id", tenantId).single();
    expect(log?.status).toBe("success");
    expect(log?.external_ref).toMatch(/^mock-inv-/);
  } finally {
    await deleteTenant(tenantId);
  }
});
