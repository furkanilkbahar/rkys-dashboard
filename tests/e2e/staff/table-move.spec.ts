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
  const subdomain = `test-tablemove-${suffix}`;
  const email = `owner-tablemove-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId, slug: subdomain, name: "Table Move Test", status: "active",
    timezone: "Europe/Istanbul", currency: "TRY", onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  const table1Id = crypto.randomUUID();
  const table2Id = crypto.randomUUID();
  await service.from("tables").insert([
    { id: table1Id, tenant_id: tenantId, branch_id: branchId, label: "Masa 1", is_active: true, qr_token_hash: crypto.randomUUID() },
    { id: table2Id, tenant_id: tenantId, branch_id: branchId, label: "Masa 2", is_active: true, qr_token_hash: crypto.randomUUID() },
  ]);

  const tableSessionId = crypto.randomUUID();
  await service.from("table_sessions").insert({ id: tableSessionId, tenant_id: tenantId, branch_id: branchId, table_id: table1Id, status: "active" });

  return { tenantId, subdomain, email, table1Id, table2Id, tableSessionId };
}

async function deleteTenant(tenantId: string) {
  await serviceClient().from("tenants").delete().eq("id", tenantId);
}

test("garson paneli: personel dolu masayı boş masaya taşıyabilir (RULES #27)", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email, table2Id, tableSessionId } = await createIsolatedTenant();
  try {
    await page.goto(tenantUrl(baseURL!, subdomain, "/admin/login"));
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill("password123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/admin$/);

    await page.goto(tenantUrl(baseURL!, subdomain, "/waiter"));
    await expect(page.getByText("Masa Taşı")).toBeVisible();
    const row = page.getByText("Masa 1", { exact: true }).locator("..");
    await expect(row).toBeVisible();

    await row.getByRole("combobox", { name: "Masaya taşı" }).click();
    await page.getByRole("option", { name: "Masa 2" }).click();
    // router.refresh() sonrası occupied-tables listesi yeniden çekilir —
    // taşınan oturumun etiketi "Masa 1"den "Masa 2"ye döner. Bu, DB
    // mutasyonunun gerçekten commit olduğunun tek güvenilir kanıtı (yalnızca
    // "Masa 2" göründüğünü beklemek zayıf bir sinyal olurdu — "Masa 2"
    // zaten seçim listesinde her zaman görünür).
    await expect(page.getByText("Masa 1", { exact: true })).toBeHidden({ timeout: 10_000 });

    const service = serviceClient();
    const { data: session } = await service.from("table_sessions").select("table_id").eq("id", tableSessionId).single();
    expect(session?.table_id).toBe(table2Id);

    const { data: events } = await service
      .from("session_events")
      .select("event_type, to_table_id")
      .eq("table_session_id", tableSessionId)
      .eq("event_type", "table_moved");
    expect(events).toHaveLength(1);
    expect(events![0].to_table_id).toBe(table2Id);
  } finally {
    await deleteTenant(tenantId);
  }
});
