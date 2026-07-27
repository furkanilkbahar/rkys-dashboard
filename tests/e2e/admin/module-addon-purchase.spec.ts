import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// Aynı sabit lokal demo anahtarları — session-panel.spec.ts'deki desenle aynı.
function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

test("S62/S63: sahibi ücretli ek modülü satın alır, ödeme onaylanınca modül otomatik açılır", async ({ page }) => {
  const service = serviceClient();
  const suffix = Date.now().toString(36);
  const slug = `test-e2e-addon-${suffix}`;
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const email = `owner-e2e-addon-${suffix}@test-throwaway.test`;
  let authUserId: string | undefined;

  try {
    await service.from("module_addon_prices").upsert({ module_key: "kiosk", price_minor: 50000 });
    const { data: starterPlan } = await service.from("plans").select("id").eq("key", "starter").single();

    await service.from("tenants").insert({
      id: tenantId,
      slug,
      name: `E2E Addon ${suffix}`,
      status: "active",
      timezone: "Europe/Istanbul",
      currency: "TRY",
      plan_id: starterPlan!.id,
      onboarding_completed_at: new Date().toISOString(),
    });
    await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
    await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${slug}.localhost:3000`, is_primary: true });
    await service.rpc("seed_tenant_modules_from_plan", { p_tenant_id: tenantId });

    const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
    authUserId = authUser!.user!.id;
    await service.from("profiles").insert({ id: authUserId, tenant_id: tenantId, role: "owner", is_active: true });

    await page.goto(`http://${slug}.localhost:3000/admin/login`);
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin$/);

    await page.goto(`http://${slug}.localhost:3000/admin/settings`);
    await expect(page.getByRole("button", { name: /Satın Al/ })).toBeVisible();
    await page.getByRole("button", { name: /Satın Al/ }).click();

    await page.waitForURL(/\/admin\/billing\/mock-addon\//, { timeout: 15_000 });
    await expect(page.getByText("Kiosk")).toBeVisible();
    await page.getByRole("button", { name: "Ödemeyi Onayla" }).click();
    await page.waitForURL(/\/admin\/settings/, { timeout: 15_000 });

    const { data: moduleRow } = await service
      .from("tenant_modules")
      .select("is_enabled, source")
      .eq("tenant_id", tenantId)
      .eq("module_key", "kiosk")
      .single();
    expect(moduleRow?.is_enabled).toBe(true);
    expect(moduleRow?.source).toBe("paid_addon");
  } finally {
    await service.from("tenants").delete().eq("id", tenantId);
    if (authUserId) await service.auth.admin.deleteUser(authUserId);
    await service.from("module_addon_prices").delete().eq("module_key", "kiosk");
  }
});
