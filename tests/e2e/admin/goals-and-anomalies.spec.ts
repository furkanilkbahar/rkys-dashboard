import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { tenantUrl } from "../helpers/tenant";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

// Kendi tenant'ını kuran desen — analytics-dashboard.spec.ts'teki gerekçeyle
// aynı (chromium-desktop + mobile-safari paralel çalışır, paylaşılan tenant
// hedef/anomali durumunu birbirine karıştırır).
async function createIsolatedTenant() {
  const service = serviceClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const subdomain = `test-goals-${suffix}`;
  const email = `owner-goals-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId,
    slug: subdomain,
    name: "Goals Test",
    status: "active",
    timezone: "Europe/Istanbul",
    currency: "TRY",
    onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  return { tenantId, branchId, subdomain, email };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

async function loginAsIsolatedOwner(page: Page, baseURL: string, subdomain: string, email: string) {
  await page.goto(tenantUrl(baseURL, subdomain, "/admin/login"));
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/admin$/);
}

test("hedef girilir, ilerleme gösterilir", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenant();
  try {
    await loginAsIsolatedOwner(page, baseURL!, subdomain, email);
    await page.goto(tenantUrl(baseURL!, subdomain, "/analytics"));

    await expect(page.getByText("Bu ay için henüz hedef belirlenmedi.")).toBeVisible();

    await page.getByLabel("Hedef Tutar").fill("50000");
    await page.getByRole("button", { name: "Kaydet" }).click();

    await expect(page.getByText("₺50.000,00", { exact: false })).toBeVisible();
    await expect(page.getByRole("progressbar")).toBeVisible();
  } finally {
    await deleteTenant(tenantId);
  }
});

test("anomali doğrudan DB'ye eklenip panelde görünür, onaylanınca kaybolur", async ({ page, baseURL }) => {
  const { tenantId, branchId, subdomain, email } = await createIsolatedTenant();
  try {
    const service = serviceClient();
    await service
      .from("anomaly_alerts")
      .insert({ tenant_id: tenantId, branch_id: branchId, business_date: "2025-06-10", message: "Test anomali mesajı" });

    await loginAsIsolatedOwner(page, baseURL!, subdomain, email);
    await page.goto(tenantUrl(baseURL!, subdomain, "/analytics"));

    await expect(page.getByText("Test anomali mesajı")).toBeVisible();

    await page.getByRole("button", { name: "Uyarıyı onayla" }).click();
    await expect(page.getByText("Test anomali mesajı")).toBeHidden();
    await expect(page.getByText("Aktif anomali uyarısı yok.")).toBeVisible();
  } finally {
    await deleteTenant(tenantId);
  }
});
