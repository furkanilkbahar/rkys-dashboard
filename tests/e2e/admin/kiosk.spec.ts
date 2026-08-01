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
  const subdomain = `test-kiosk-${suffix}`;
  const email = `owner-kiosk-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Kiosk Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert({ tenant_id: tenantId, module_key: "kiosk", is_enabled: true });
  await service.from("tenant_locales").insert({ tenant_id: tenantId, locale: "tr", is_default: true });

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  return { tenantId, subdomain, email };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("S46: admin kiosk cihazı ekler, tablet pairing code ile /paket'e bağlanır, kiosk_device_id set edilir, sıradaki müşteri yeni oturum açar", async ({ browser, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenant();
  try {
    const adminContext = await browser.newContext();
    const page = await adminContext.newPage();
    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin$/);

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/kiosk"));
    await page.getByLabel("Cihaz Adı").fill("Giriş Tableti");
    await page.getByRole("button", { name: "+ Ekle" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Giriş Tableti")).toBeVisible();

    const pairingCode = await page.locator("code").textContent();
    expect(pairingCode).toMatch(/^[A-F0-9]{8}$/);

    // bug-hunt 2026-08-01: önceden yalnızca "/kiosk/{code}/baslat" göreli
    // yolu gösteriliyordu, personel domain'i elle tahmin etmek zorunda
    // kalıyordu — artık tam, kopyalanabilir bir URL (tenant'ın kendi
    // subdomain'i) gösterilir.
    const expectedPairingUrl = tenantUrl(baseURL!, subdomain, `/kiosk/${pairingCode}/baslat`);
    await expect(page.getByText(`Tablette açın: ${expectedPairingUrl}`)).toBeVisible();

    const kioskContext = await browser.newContext();
    const kioskPage = await kioskContext.newPage();
    await kioskPage.goto(tenantUrl(baseURL!, subdomain, `/kiosk/${pairingCode}/baslat`));
    await expect(kioskPage).toHaveURL(/\/paket$/);
    const codeLocator = kioskPage.getByText(/Teslim Kodunuz: [A-Z0-9]{6}/);
    await expect(codeLocator).toBeVisible();
    const firstCodeText = await codeLocator.textContent();
    await expect(kioskPage.getByRole("button", { name: "Sıradaki Müşteri" })).toBeVisible();

    const service = serviceClient();
    const { data: firstSession } = await service
      .from("table_sessions")
      .select("id, kiosk_device_id")
      .eq("tenant_id", tenantId)
      .single();
    expect(firstSession?.kiosk_device_id).not.toBeNull();

    await kioskPage.getByRole("button", { name: "Sıradaki Müşteri" }).click();
    // Hedef URL kaynak URL ile aynı (/paket) olduğu için toHaveURL(/\/paket$/)
    // gerçek bir round-trip beklemeden anında geçer (yarış durumu) — bunun
    // yerine teslim kodunun GERÇEKTEN değiştiğini bekleriz, bu da yeni bir
    // oturumun gerçekten açıldığının kanıtıdır.
    await expect(codeLocator).not.toHaveText(firstCodeText!, { timeout: 15_000 });

    const { data: allSessions } = await service.from("table_sessions").select("id").eq("tenant_id", tenantId);
    expect(allSessions).toHaveLength(2);
    expect(new Set(allSessions!.map((s) => s.id)).size).toBe(2);

    await kioskPage.goto(tenantUrl(baseURL!, subdomain, "/kiosk/WRONGCODE/baslat"));
    await expect(kioskPage).toHaveURL(/\/kiosk\/WRONGCODE\/gecersiz$/);

    await adminContext.close();
    await kioskContext.close();
  } finally {
    await deleteTenant(tenantId);
  }
});
