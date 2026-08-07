import { createHash } from "crypto";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { loginAsPlatformAdmin } from "../helpers/tenant";

/**
 * S56 (D101): süper admin havale/EFT tahsilatını "Ödemesi alındı" ile
 * işaretler ve trial'ı dolmuş tenant aynı anda pasiflikten çıkar.
 *
 * S13 (trial-subscription.spec.ts) trial bitişinin ERİŞİM davranışını zaten
 * kapsıyor — burada test edilen, sağlayıcı checkout'undan geçmeyen ödemenin
 * yolu. trial-subscription.spec.ts'deki gerekçenin aynısıyla her koşum kendi
 * tek kullanımlık tenant'ını kurar: paylaşılan bir tenant'ın abonelik
 * durumunu mutasyona uğratmak iki proje paralel koşarken yarışa girer.
 */
function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

async function createExpiredTrialTenant() {
  const service = serviceClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const subdomain = `test-markpaid-${suffix}`;
  const email = `owner-markpaid-${suffix}@test-throwaway.test`;
  const rawToken = `demo-markpaid-${suffix}`;

  const { data: starterPlan } = await service.from("plans").select("id").eq("key", "starter").single();

  await service.from("tenants").insert({
    id: tenantId,
    slug: subdomain,
    name: "Mark Paid Test",
    status: "active",
    plan_id: starterPlan!.id,
    timezone: "Europe/Istanbul",
    currency: "TRY",
    onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service
    .from("tenant_domains")
    .insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tables").insert({
    tenant_id: tenantId,
    branch_id: branchId,
    label: "Masa 1",
    qr_token_hash: createHash("sha256").update(rawToken).digest("hex"),
  });

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  // Trial'ı bitmiş kabul et.
  await service
    .from("subscriptions")
    .update({ trial_ends_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() })
    .eq("tenant_id", tenantId);

  return { tenantId, subdomain, email };
}

test("S56: süper admin 'ödemesi alındı' der, trial'ı dolmuş tenant aynı anda serbest kalır", async ({
  page,
  baseURL,
}) => {
  const { tenantId, subdomain, email } = await createExpiredTrialTenant();
  const base = new URL(baseURL!);
  base.hostname = `${subdomain}.${base.hostname}`;

  try {
    // Trial dolu: giriş personeli panele değil ödeme sayfasına düşürür (S13).
    await page.goto(`${base.origin}/admin/login`);
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin\/billing$/);

    // Havale/EFT yolu: tahsilat sağlayıcı checkout'undan geçmiyor, süper
    // admin elle işaretliyor.
    await loginAsPlatformAdmin(page, baseURL!);
    await page.goto(`${baseURL}/platform/tenants/${tenantId}`);
    await page.getByRole("button", { name: "Ödemesi alındı olarak işaretle" }).click();
    // Buton aktif abonelikte gizli — kaybolması işlemin tuttuğunun kanıtı.
    await expect(page.getByRole("button", { name: "Ödemesi alındı olarak işaretle" })).not.toBeVisible();
    await expect(page.getByText("Yenileme:")).toBeVisible();

    // Hiçbir zamanlanmış görev beklenmeden panel geri açılır.
    await page.goto(`${base.origin}/admin/login`);
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin$/);
  } finally {
    await serviceClient().from("tenants").delete().eq("id", tenantId);
  }
});
