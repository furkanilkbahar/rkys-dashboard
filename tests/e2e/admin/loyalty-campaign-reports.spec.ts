import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { tenantUrl } from "../helpers/tenant";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

async function createIsolatedTenantWithLoyaltyData() {
  const service = serviceClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const subdomain = `test-reports-loyalty-${suffix}`;
  const email = `owner-reports-loyalty-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Loyalty Report Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  const { data: customer } = await service
    .from("customers")
    .insert({ tenant_id: tenantId, phone: "+905559990000", kvkk_consented_at: new Date().toISOString() })
    .select("id")
    .single();
  await service.from("loyalty_transactions").insert([
    { tenant_id: tenantId, customer_id: customer!.id, delta: 15, type: "earn" },
    { tenant_id: tenantId, customer_id: customer!.id, delta: -5, type: "redeem" },
  ]);

  return { tenantId, subdomain, email };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("S33: sadakat/kampanya performans raporu doğru sayıları gösterir", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenantWithLoyaltyData();
  try {
    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin$/);

    // tenantUrl yalnızca pathname'i ayarlar — içine gömülen "?" query
    // string'e değil, URL-encode edilmiş bir path segmentine dönüşür (gerçek
    // olmayan bir route'a düşüp 404 verir). Query, path'ten ayrı eklenir.
    const today = new Date().toISOString().slice(0, 10);
    const reportsUrl = new URL(tenantUrl(baseURL!, subdomain, "/admin/reports"));
    reportsUrl.searchParams.set("periodStart", today);
    reportsUrl.searchParams.set("periodEnd", today);
    await page.goto(reportsUrl.toString());

    await expect(page.getByText("Sadakat & Kampanya Performansı")).toBeVisible();
    await expect(page.getByText("Kazanılan Puan/Damga: 15")).toBeVisible();
    await expect(page.getByText("Harcanan Puan/Damga: 5")).toBeVisible();
    await expect(page.getByText("Aktif Müşteri: 1")).toBeVisible();
    await expect(page.getByText("Harcama Sayısı: 1")).toBeVisible();
    await expect(page.getByText("Bu dönemde kampanya kullanımı yok.")).toBeVisible();
  } finally {
    await deleteTenant(tenantId);
  }
});
