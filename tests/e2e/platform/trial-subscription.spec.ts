import { createHash } from "crypto";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// Aynı sabit lokal demo anahtarları — session-panel.spec.ts'deki desenle aynı.
function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

// chromium-desktop ve mobile-safari projeleri bu spec'i PARALEL çalıştırır
// (playwright.config.ts: fullyParallel). Paylaşılan bir tenant (ör. beta)
// kullanılsaydı, bu testin abonelik durumunu mutasyona uğratan doğası
// (trial'ı bitirme → aktifleştirme → afterEach'te sıfırlama) iki proje
// arasında yarış durumuna yol açardı — biri bitirip afterEach'iyle sıfırlarken
// diğeri hâlâ ortasındaysa test kendi kendini bozar. Bunun yerine her
// çalıştırma kendi tek kullanımlık tenant'ını (subdomain + masa) kurar.
async function createIsolatedTrialTenant() {
  const service = serviceClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const tableId = crypto.randomUUID();
  const subdomain = `test-trial-${suffix}`;
  const email = `owner-trial-${suffix}@test-throwaway.test`;
  const rawToken = `demo-trial-${suffix}`;

  await service.from("tenants").insert({
    id: tenantId,
    slug: subdomain,
    name: "Trial Test",
    status: "active",
    timezone: "Europe/Istanbul",
    currency: "TRY",
    onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tables").insert({
    id: tableId,
    tenant_id: tenantId,
    branch_id: branchId,
    label: "Masa 1",
    qr_token_hash: createHash("sha256").update(rawToken).digest("hex"),
  });

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  return { tenantId, subdomain, email, rawToken };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("S13: trial bitince personel paneli kısıtlanır, mock ödemeyle abonelik aktifleşince serbest kalır", async ({
  page,
  request,
  baseURL,
}) => {
  const { tenantId, subdomain, email, rawToken } = await createIsolatedTrialTenant();

  try {
    const service = serviceClient();
    // Trial'ı bitmiş kabul et (S13: erişim davranışı).
    await service
      .from("subscriptions")
      .update({ trial_ends_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() })
      .eq("tenant_id", tenantId);

    const base = new URL(baseURL!);
    base.hostname = `${subdomain}.${base.hostname}`;

    await page.goto(`${base.origin}/admin/login`);
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin\/billing$/);
    await expect(page.getByRole("button", { name: "Ödeme Yap" })).toBeVisible();

    // Misafir menüsü hâlâ çalışmalı (S13 kararı: tam kilit değil). `request`
    // fixture'ı (page.request DEĞİL) kullanılır — page.request page ile AYNI
    // çerez kavanozunu paylaşır, bu da misafir bootstrap'ının owner oturum
    // çerezinin üzerine yazmasına (guest anonymous sign-in) yol açardı.
    const guestResponse = await request.get(`${base.origin}/masa/t/${rawToken}`);
    expect(guestResponse.ok()).toBe(true);

    await page.getByRole("button", { name: "Ödeme Yap" }).click();
    await expect(page).toHaveURL(/\/admin\/billing\/mock\//);
    await expect(page.getByText("Sahte Ödeme Sayfası")).toBeVisible();
    await page.getByRole("button", { name: "Ödemeyi Onayla" }).click();

    await expect(page).toHaveURL(/\/admin\/billing$/);
    await expect(page.getByText("Aktif")).toBeVisible();

    await page.goto(`${base.origin}/admin`);
    await expect(page).toHaveURL(/\/admin$/);
  } finally {
    await deleteTenant(tenantId);
  }
});
