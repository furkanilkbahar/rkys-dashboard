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
  const subdomain = `test-courier-loc-${suffix}`;
  const ownerEmail = `owner-courier-loc-${suffix}@test-throwaway.test`;
  const courierEmail = `courier-loc-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Courier Location Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert([{ tenant_id: tenantId, module_key: "courier", is_enabled: true }]);

  const { data: ownerAuth } = await service.auth.admin.createUser({ email: ownerEmail, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: ownerAuth!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  const { data: courierAuth } = await service.auth.admin.createUser({ email: courierEmail, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: courierAuth!.user!.id, tenant_id: tenantId, role: "courier", badge_no: "K1", is_active: true });

  return { tenantId, subdomain, ownerEmail, courierEmail, courierId: courierAuth!.user!.id as string };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("S66: kurye konum paylaşımını başlatır, garson panelinde haritada belirir", async ({ browser, baseURL }) => {
  const { tenantId, subdomain, ownerEmail, courierEmail, courierId } = await createIsolatedTenant();
  try {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await ownerPage.getByLabel("E-posta").fill(ownerEmail);
    await ownerPage.getByLabel("Şifre").fill("password123");
    await ownerPage.getByRole("button", { name: "Giriş yap" }).click();
    await ownerPage.waitForURL(/\/admin$/);
    await ownerPage.goto(tenantUrl(baseURL!, subdomain, "/waiter"));
    await expect(ownerPage.getByText("Kurye Ataması")).toBeVisible();

    const tenantOrigin = new URL(tenantUrl(baseURL!, subdomain, "/")).origin;
    const courierContext = await browser.newContext(
      { geolocation: { latitude: 41.015, longitude: 28.979 }, permissions: ["geolocation"] },
    );
    const courierPage = await courierContext.newPage();
    await courierContext.grantPermissions(["geolocation"], { origin: tenantOrigin });
    await courierPage.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await courierPage.getByLabel("E-posta").fill(courierEmail);
    await courierPage.getByLabel("Şifre").fill("password123");
    await courierPage.getByRole("button", { name: "Giriş yap" }).click();
    await courierPage.waitForURL(/\/admin$/);

    await courierPage.goto(tenantUrl(baseURL!, subdomain, "/courier"));
    await courierPage.getByRole("button", { name: "Konum Paylaşımını Başlat" }).click();
    await expect(courierPage.getByRole("button", { name: "Konum Paylaşımını Durdur" })).toBeVisible();

    // watchPosition'ın ilk callback'i tetiklenip RPC'nin veritabanına
    // yazması, tarayıcı/geolocation emülasyonuna bağlı olarak değişken
    // sürebiliyor — bu yüzden UI zamanlamasına bağlı bir poll yerine
    // doğrudan veritabanını (yazma gerçekleşti mi) bekliyoruz. Realtime
    // kanalının bu ortamda canlı push'u güvenilir şekilde test etmek için
    // elverişli olmadığı ayrıca gözlemlendi (bkz. mevcut
    // waiter-call-realtime.spec.ts'teki ortam kısıtı) — bu yüzden asıl
    // doğrulanan şey RPC→DB→SSR veri katmanı zinciri: sayfa yenilenince
    // konum görünür olmalı.
    const service = serviceClient();
    await expect
      .poll(
        async () => {
          const { data } = await service.from("courier_locations").select("courier_id").eq("courier_id", courierId).maybeSingle();
          return data !== null;
        },
        { timeout: 20_000 },
      )
      .toBe(true);

    await ownerPage.reload();
    await expect(ownerPage.locator(".courier-marker")).toBeVisible({ timeout: 10_000 });

    await ownerContext.close();
    await courierContext.close();
  } finally {
    await deleteTenant(tenantId);
  }
});
