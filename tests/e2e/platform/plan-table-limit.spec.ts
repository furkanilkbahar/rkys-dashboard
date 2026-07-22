import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { betaUrl, loginAsBetaOwner } from "../helpers/tenant";

const BETA_TENANT_ID = "00000000-0000-4000-8000-000000000002";

// Aynı sabit lokal demo anahtarları — session-panel.spec.ts'deki desenle aynı.
function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

test.afterEach(async () => {
  // beta diğer testlerde plansız (sınırsız) varsayılıyor — test başarısız
  // olsa bile plan_id ve starter'ın table_limit'i her zaman eski haline
  // döner (tenant-suspend.spec.ts'deki afterEach ile aynı desen).
  const service = serviceClient();
  await service.from("tenants").update({ plan_id: null }).eq("id", BETA_TENANT_ID);
  const { data: starter } = await service.from("plans").select("id").eq("key", "starter").single();
  await service.from("plans").update({ table_limit: 10 }).eq("id", starter!.id);
  await service.from("tables").delete().eq("tenant_id", BETA_TENANT_ID).eq("label", "Serbest Masa");
});

test("S12: plan masa limiti dolunca ekleme engellenir, plan kaldırılınca serbest kalır", async ({ page, baseURL }) => {
  const service = serviceClient();
  const { count } = await service
    .from("tables")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", BETA_TENANT_ID);
  const { data: starter } = await service.from("plans").select("id").eq("key", "starter").single();
  await service.from("plans").update({ table_limit: count }).eq("id", starter!.id);
  await service.from("tenants").update({ plan_id: starter!.id }).eq("id", BETA_TENANT_ID);

  await loginAsBetaOwner(page, baseURL!);
  await page.goto(betaUrl(baseURL!, "/admin/tables"));
  await page.getByLabel("Masa adı").fill("Fazla Masa");
  await page.getByRole("button", { name: "+ Masa Ekle" }).click();
  await expect(
    page.getByText("Planınızın masa limitine ulaştınız. Devam etmek için planınızı yükseltin."),
  ).toBeVisible();

  await service.from("tenants").update({ plan_id: null }).eq("id", BETA_TENANT_ID);
  await page.reload();
  await page.getByLabel("Masa adı").fill("Serbest Masa");
  await page.getByRole("button", { name: "+ Masa Ekle" }).click();
  await expect(page.getByText("Serbest Masa").first()).toBeVisible();
  await expect(page.getByText("PNG İndir")).toBeVisible();
});
