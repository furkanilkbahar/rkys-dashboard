import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { loginAsPlatformAdmin, tenantUrl } from "../helpers/tenant";

/**
 * S56 (D101): trial dolduğunda tenant pasife düşer ve giriş denemesi ödeme
 * yoluna çıkar. Bu senaryo `beta` tenant'ının abonelik satırını oynattığı
 * için seri çalışır — paralel bir spec aynı anda beta'yı kullanırsa onu da
 * kapıya çarptırır.
 */
test.describe.configure({ mode: "serial" });

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

async function betaTenantId() {
  const { data } = await serviceClient().from("tenants").select("id").eq("slug", "beta").single();
  return data!.id as string;
}

test.afterEach(async () => {
  // Aboneliği seed'deki hâline (süren trial) geri al.
  await serviceClient()
    .from("subscriptions")
    .update({
      status: "trialing",
      trial_ends_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      provider: null,
      provider_ref: null,
      current_period_end: null,
    })
    .eq("tenant_id", await betaTenantId());
});

test("S56: trial dolan tenant pasife düşer — panel ve QR menü kapanır, giriş ödeme sayfasına çıkar", async ({
  page,
  baseURL,
}) => {
  const service = serviceClient();
  await service
    .from("subscriptions")
    .update({ status: "trialing", trial_ends_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("tenant_id", await betaTenantId());

  // Personel paneli kapanır.
  await page.goto(tenantUrl(baseURL!, "beta", "/admin"));
  await expect(page.getByText("Deneme süreniz doldu")).toBeVisible();

  // Misafir QR menüsü de kapanır — ödemeyen işletme servis vermez.
  await page.goto(tenantUrl(baseURL!, "beta", "/masa/herhangi"));
  await expect(page.getByText("Deneme süreniz doldu")).toBeVisible();

  // Ama giriş ve ödeme yolu AÇIK kalır, yoksa kilidi açmanın yolu olmazdı.
  await page.goto(tenantUrl(baseURL!, "beta", "/admin/login"));
  await expect(page.getByLabel("E-posta")).toBeVisible();

  await page.getByLabel("E-posta").fill("owner@beta.test");
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Giriş yap" }).click();

  // Giriş sonrası panele değil, ödeme kapısına düşer.
  await expect(page.getByText("Deneme süreniz doldu")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: "Plan seçip ödeme yap" }).click();
  await page.waitForURL(/\/admin\/billing/, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Ödeme Yap" })).toBeVisible();
});

test("S56: süper admin 'ödemesi alındı' der ve tenant aynı anda geri açılır", async ({ page, baseURL }) => {
  const service = serviceClient();
  const tenantId = await betaTenantId();
  await service
    .from("subscriptions")
    .update({ status: "trialing", trial_ends_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("tenant_id", tenantId);

  await page.goto(tenantUrl(baseURL!, "beta", "/admin"));
  await expect(page.getByText("Deneme süreniz doldu")).toBeVisible();

  // Havale/EFT yolu: tahsilat sağlayıcı checkout'undan geçmiyor, süper admin
  // elle işaretliyor.
  await loginAsPlatformAdmin(page, baseURL!);
  await page.goto(`${baseURL}/platform/tenants/${tenantId}`);
  await page.getByRole("button", { name: "Ödemesi alındı olarak işaretle" }).click();
  await expect(page.getByRole("button", { name: "Ödemesi alındı olarak işaretle" })).not.toBeVisible();

  // Hiçbir zamanlanmış görev beklenmeden kapı açılır.
  await page.goto(tenantUrl(baseURL!, "beta", "/admin/login"));
  await expect(page.getByLabel("E-posta")).toBeVisible();
  await expect(page.getByText("Deneme süreniz doldu")).not.toBeVisible();
});
