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
  const subdomain = `test-perf-goal-${suffix}`;
  const email = `owner-perf-goal-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId,
    slug: subdomain,
    name: "Performance Goal Test",
    status: "active",
    timezone: "Europe/Istanbul",
    currency: "TRY",
    onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert({ tenant_id: tenantId, module_key: "staff_scheduling", is_enabled: true });

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  const { data: profile } = await service
    .from("profiles")
    .insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true, badge_no: "OWN-1" })
    .select()
    .single();

  return { tenantId, subdomain, email, profileId: profile!.id };
}

test("S65: owner personel için hedef belirler, ilerleme görünür", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email, profileId } = await createIsolatedTenant();

  try {
    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin$/);

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/scheduling"));
    await expect(page.getByText("Personel Hedefleri")).toBeVisible();

    const row = page.getByTestId(`staff-performance-row-${profileId}`);
    await row.getByPlaceholder("Hedef").fill("5");
    await row.getByRole("button", { name: "Hedefi Kaydet" }).click();
    await page.waitForLoadState("networkidle");

    await expect(row.getByText("0 çağrı karşılandı")).toBeVisible();
    await expect(row.getByText("0/5")).toBeVisible();
  } finally {
    await serviceClient().from("tenants").delete().eq("id", tenantId);
  }
});
