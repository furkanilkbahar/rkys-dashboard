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
  const subdomain = `test-reservations-${suffix}`;
  const email = `owner-reservations-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Reservations Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });
  await service.from("tenant_modules").insert({ tenant_id: tenantId, module_key: "reservations", is_enabled: true });

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  const zoneId = crypto.randomUUID();
  await service.from("table_zones").insert({ id: zoneId, tenant_id: tenantId, branch_id: branchId, name: "Salon", display_order: 0 });
  const { error: tableError } = await service
    .from("tables")
    .insert({ tenant_id: tenantId, branch_id: branchId, label: "Masa 1", zone_id: zoneId, is_active: true, qr_token_hash: crypto.randomUUID() });
  if (tableError) throw tableError;

  return { tenantId, subdomain, email };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("S45: misafir rezervasyon talebi gönderir, admin onaylar/masa atar/oturtur; bekleme listesine ekleyip çağırır", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenant();
  try {
    await page.goto(tenantUrl(baseURL!, subdomain, "/rezervasyon"));
    await page.getByLabel("Ad Soyad").fill("Ayşe Yılmaz");
    await page.getByLabel("Telefon").fill("05551112233");
    await page.getByLabel("Kişi Sayısı").fill("4");
    await page.getByLabel("Tarih/Saat").fill("2027-01-15T19:30");
    await page.getByRole("button", { name: "Rezervasyon Talebi Gönder" }).click();
    await expect(page.getByText("Rezervasyon talebiniz alındı.")).toBeVisible();

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin$/);

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/reservations"));
    await expect(page.getByText("Ayşe Yılmaz")).toBeVisible();

    await page.getByRole("combobox", { name: "Masa", exact: true }).click();
    await page.getByRole("option", { name: "Masa 1" }).click();
    await page.getByRole("button", { name: "Onayla" }).click();
    await expect(page.getByText("Onaylandı")).toBeVisible({ timeout: 10_000 });

    const service = serviceClient();
    const { data: confirmed } = await service.from("reservations").select("status, table_id").eq("tenant_id", tenantId).single();
    expect(confirmed?.status).toBe("confirmed");
    expect(confirmed?.table_id).not.toBeNull();

    await page.getByRole("button", { name: "Oturttu" }).click();
    await expect(page.getByText("Oturdu")).toBeVisible({ timeout: 10_000 });
    const { data: seated } = await service.from("reservations").select("status").eq("tenant_id", tenantId).single();
    expect(seated?.status).toBe("seated");

    const waitlistCard = page.locator('[data-slot="card"]').filter({ hasText: "Bekleme Listesi" });
    await waitlistCard.getByLabel("Ad Soyad").fill("Mehmet Kaya");
    await waitlistCard.getByLabel("Kişi Sayısı").fill("2");
    await waitlistCard.getByRole("button", { name: "+ Ekle" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Mehmet Kaya")).toBeVisible();

    await waitlistCard.getByRole("button", { name: "Çağır" }).click();
    await expect(waitlistCard.getByText("Çağrıldı")).toBeVisible({ timeout: 10_000 });
    const { data: waitlistCalled } = await service.from("waitlist_entries").select("status").eq("tenant_id", tenantId).single();
    expect(waitlistCalled?.status).toBe("called");

    await waitlistCard.getByRole("button", { name: "Oturttu" }).click();
    await expect(waitlistCard.getByText("Mehmet Kaya")).toBeHidden({ timeout: 10_000 });
    const { data: waitlistSeated } = await service.from("waitlist_entries").select("status").eq("tenant_id", tenantId).single();
    expect(waitlistSeated?.status).toBe("seated");
  } finally {
    await deleteTenant(tenantId);
  }
});

test("bug-hunt 2026-08-01: personel masa seçerek doğrudan rezervasyon ekler (datetime-local + tableId regresyonu)", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenant();
  try {
    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin$/);

    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/reservations"));

    const reservationsCard = page.locator('[data-slot="card"]').filter({ hasText: "Rezervasyonlar" });
    await reservationsCard.getByLabel("Ad Soyad").fill("Can Öztürk");
    await reservationsCard.getByLabel("Telefon").fill("05553334455");
    await reservationsCard.getByLabel("Kişi Sayısı").fill("3");
    await reservationsCard.getByLabel("Tarih/Saat").fill("2027-02-20T18:00");
    await reservationsCard.getByRole("combobox", { name: "Masa (opsiyonel)" }).click();
    await page.getByRole("option", { name: "Masa 1" }).click();
    await reservationsCard.getByRole("button", { name: "+ Ekle" }).click();

    await expect(page.getByText("Can Öztürk")).toBeVisible({ timeout: 10_000 });

    const service = serviceClient();
    const { data: created } = await service
      .from("reservations")
      .select("status, table_id, reserved_at")
      .eq("tenant_id", tenantId)
      .single();
    expect(created?.status).toBe("confirmed");
    expect(created?.table_id).not.toBeNull();
    expect(created?.reserved_at).toContain("2027-02-20");
  } finally {
    await deleteTenant(tenantId);
  }
});
