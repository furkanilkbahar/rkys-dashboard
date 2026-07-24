import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { tenantUrl } from "../helpers/tenant";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

async function createIsolatedTenantWithDeliveryOrder() {
  const service = serviceClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const subdomain = `test-courier-${suffix}`;
  const ownerEmail = `owner-courier-${suffix}@test-throwaway.test`;
  const courierEmail = `courier-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Courier Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert([
    { tenant_id: tenantId, module_key: "delivery", is_enabled: true },
    { tenant_id: tenantId, module_key: "courier", is_enabled: true },
  ]);

  const { data: ownerAuth } = await service.auth.admin.createUser({ email: ownerEmail, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: ownerAuth!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  const { data: courierAuth } = await service.auth.admin.createUser({ email: courierEmail, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: courierAuth!.user!.id, tenant_id: tenantId, role: "courier", badge_no: "K1", is_active: true });

  await service.from("table_sessions").insert({ tenant_id: tenantId, branch_id: branchId, table_id: null, channel: "delivery", status: "active" });
  const { data: session } = await service.from("table_sessions").select("id").eq("tenant_id", tenantId).single();
  const orderId = crypto.randomUUID();
  await service.from("orders").insert({
    id: orderId, tenant_id: tenantId, branch_id: branchId, table_session_id: session!.id,
    status: "approved", subtotal_minor: 6000, channel: "delivery", idempotency_key: crypto.randomUUID(),
    delivery_address_snapshot: "Test Mahallesi No:9",
  });

  return { tenantId, subdomain, ownerEmail, courierEmail, orderId };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("S40: personel kurye atar, kurye teslimatı yolda→teslim edildi olarak ilerletir", async ({ browser, baseURL }) => {
  const { tenantId, subdomain, ownerEmail, courierEmail, orderId } = await createIsolatedTenantWithDeliveryOrder();
  try {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await ownerPage.getByLabel("E-posta").fill(ownerEmail);
    await ownerPage.getByLabel("Şifre").fill("password123");
    await ownerPage.getByRole("button", { name: "Giriş yap" }).click();
    await ownerPage.waitForURL(/\/admin$/);

    await ownerPage.goto(tenantUrl(baseURL!, subdomain, "/waiter"));
    await expect(ownerPage.getByText("Test Mahallesi No:9")).toBeVisible();
    await ownerPage.getByRole("combobox", { name: "Kurye Ata" }).click();
    await ownerPage.getByRole("option", { name: "K1" }).click();
    await ownerPage.waitForLoadState("networkidle");

    const courierContext = await browser.newContext();
    const courierPage = await courierContext.newPage();
    await courierPage.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await courierPage.getByLabel("E-posta").fill(courierEmail);
    await courierPage.getByLabel("Şifre").fill("password123");
    await courierPage.getByRole("button", { name: "Giriş yap" }).click();
    await courierPage.waitForURL(/\/admin$/);

    await courierPage.goto(tenantUrl(baseURL!, subdomain, "/courier"));
    const card = courierPage.locator('[data-slot="card"]').filter({ hasText: "Test Mahallesi No:9" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Yola Çık" }).click();
    await expect(card.getByRole("button", { name: "Teslim Edildi" })).toBeVisible();
    await card.getByRole("button", { name: "Teslim Edildi" }).click();
    await expect(card).toHaveCount(0);

    const service = serviceClient();
    const { data: assignment } = await service.from("courier_assignments").select("status").eq("order_id", orderId).single();
    expect(assignment?.status).toBe("delivered");

    await ownerContext.close();
    await courierContext.close();
  } finally {
    await deleteTenant(tenantId);
  }
});
