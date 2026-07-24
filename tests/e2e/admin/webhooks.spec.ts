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
  const subdomain = `test-webhooks-${suffix}`;
  const email = `owner-webhooks-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Webhooks Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert({ tenant_id: tenantId, module_key: "api_access", is_enabled: true });

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  return { tenantId, subdomain, email };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("S42: admin webhook kaydeder, imza sırrı görünür, pasif hale getirebilir", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenant();
  try {
    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin$/);

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/webhooks"));
    await page.getByLabel("Hedef URL").fill("https://example.com/hook");
    await page.getByText("Sipariş oluşturuldu", { exact: true }).click();
    await page.getByRole("button", { name: "+ Webhook Ekle" }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("https://example.com/hook")).toBeVisible();
    await expect(page.locator("code")).toContainText("whsec_");

    const service = serviceClient();
    const { data: webhook } = await service.from("webhooks").select("id, is_active, event_types").eq("tenant_id", tenantId).single();
    expect(webhook?.is_active).toBe(true);
    expect(webhook?.event_types).toEqual(["order.created"]);

    await page.getByRole("switch").click();
    await expect(page.getByRole("switch")).toHaveAttribute("aria-checked", "false", { timeout: 10_000 });
    const { data: toggled } = await service.from("webhooks").select("is_active").eq("id", webhook!.id).single();
    expect(toggled?.is_active).toBe(false);
  } finally {
    await deleteTenant(tenantId);
  }
});
