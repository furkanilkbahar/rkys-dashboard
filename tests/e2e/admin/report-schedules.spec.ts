import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { tenantUrl } from "../helpers/tenant";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

// Kendi tenant'ını kuran desen — diğer Faz 5 E2E'leriyle aynı gerekçe
// (chromium-desktop + mobile-safari paralel çalışır, paylaşılan tenant
// report_schedules/sent_emails durumunu birbirine karıştırır).
async function createIsolatedTenant() {
  const service = serviceClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const subdomain = `test-reportsched-${suffix}`;
  const email = `owner-reportsched-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId,
    slug: subdomain,
    name: "Report Schedule Test",
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

test("S24: zamanlanmış rapor oluşturulur, 'Şimdi Gönder' ile anlık tetiklenir, mock e-posta kaydı oluşur", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenant();
  try {
    await loginAsIsolatedOwner(page, baseURL!, subdomain, email);
    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/settings"));

    // CardTitle bir <div> render eder (heading rolü değil, bkz. diğer Faz 5
    // spec'lerindeki aynı not) — metinle hedeflenir.
    await expect(page.getByText("Zamanlanmış Raporlar")).toBeVisible();
    await page.getByLabel("Alıcı E-posta").fill("digest@example.com");
    await page.getByRole("button", { name: "+ Ekle" }).click();

    const card = page.locator('[data-slot="card"]').filter({ hasText: "digest@example.com" });
    await expect(card.getByText("digest@example.com")).toBeVisible();
    await expect(card.getByText("Henüz gönderilmedi")).toBeVisible();

    await card.getByRole("button", { name: "Şimdi Gönder" }).click();
    await expect(card.getByText("Gönderildi")).toBeVisible();
    await expect(card.getByText("Henüz gönderilmedi")).toBeHidden();

    const service = serviceClient();
    const { data: sentEmails } = await service.from("sent_emails").select("to_email, provider, has_attachment").eq("tenant_id", tenantId);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails![0].to_email).toBe("digest@example.com");
    expect(sentEmails![0].provider).toBe("mock");
    expect(sentEmails![0].has_attachment).toBe(true);

    const { data: schedule } = await service.from("report_schedules").select("last_sent_at").eq("tenant_id", tenantId).single();
    expect(schedule?.last_sent_at).not.toBeNull();
  } finally {
    await deleteTenant(tenantId);
  }
});

test("zamanlanmış rapor silinebilir ve aktif/pasif yapılabilir", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenant();
  try {
    await loginAsIsolatedOwner(page, baseURL!, subdomain, email);
    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/settings"));

    await page.getByLabel("Alıcı E-posta").fill("toggle@example.com");
    await page.getByRole("button", { name: "+ Ekle" }).click();
    await expect(page.getByText("toggle@example.com")).toBeVisible();

    // Sayfada başka birçok Switch/"Sil" var (modüller, sebep kodları vb.) —
    // Zamanlanmış Raporlar kartına özgü satıra kartla scope edilerek ulaşılır.
    const card = page.locator('[data-slot="card"]').filter({ hasText: "toggle@example.com" });
    await card.getByRole("switch").click();
    await page.waitForLoadState("networkidle");

    await card.getByRole("button", { name: "Sil" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("toggle@example.com")).toBeHidden();
  } finally {
    await deleteTenant(tenantId);
  }
});
