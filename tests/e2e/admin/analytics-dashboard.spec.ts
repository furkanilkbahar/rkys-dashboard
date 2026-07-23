import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { tenantUrl } from "../helpers/tenant";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

// chromium-desktop ve mobile-safari bu spec'i PARALEL çalıştırır. Widget
// düzeni tek bir kullanıcıya bağlı kalıcı state olduğundan (dashboard_widgets,
// user_id primary key), paylaşılan bir seed tenant/owner kullanmak iki proje
// arasında aynı satırları eşzamanlı mutasyona uğratıp yarış durumuna yol
// açardı (bkz. trial-subscription.spec.ts'teki aynı desen) — her test kendi
// tek kullanımlık tenant+owner'ını kurar.
async function createIsolatedTenant() {
  const service = serviceClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const subdomain = `test-analytics-${suffix}`;
  const email = `owner-analytics-${suffix}@test-throwaway.test`;

  await service.from("tenants").insert({
    id: tenantId,
    slug: subdomain,
    name: "Analytics Test",
    status: "active",
    timezone: "Europe/Istanbul",
    currency: "TRY",
    onboarding_completed_at: new Date().toISOString(),
  });
  await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Şube", is_default: true });
  await service.from("tenant_domains").insert({ tenant_id: tenantId, domain: `${subdomain}.localhost:3000`, is_primary: true });

  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "owner", is_active: true });

  return { tenantId, subdomain, email };
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

// CardTitle bir <div> render eder (heading rolü değil) — widget başlığı
// spesifik olarak [data-slot="card-title"] ile hedeflenir, aksi halde
// gizli-widget listesindeki aynı metinli buton ile karışabilir.
function widgetTitle(page: Page, text: string) {
  return page.locator('[data-slot="card-title"]', { hasText: text });
}

test("Analitik paneli açılır, tüm widget'lar görünür", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenant();
  try {
    await loginAsIsolatedOwner(page, baseURL!, subdomain, email);
    await page.goto(tenantUrl(baseURL!, subdomain, "/analytics"));

    await expect(page.getByRole("heading", { name: "Analitik Merkezi" })).toBeVisible();
    await expect(widgetTitle(page, "Bugünün Cirosu")).toBeVisible();
    await expect(widgetTitle(page, "Bugünün Sipariş Sayısı")).toBeVisible();
    await expect(widgetTitle(page, "Saatlik Yoğunluk")).toBeVisible();
    await expect(widgetTitle(page, "En Çok Satanlar")).toBeVisible();
    await expect(widgetTitle(page, "Şube Kıyası (Son 30 Gün)")).toBeVisible();
  } finally {
    await deleteTenant(tenantId);
  }
});

test("widget gizlenip tekrar gösterilebilir, durum kalıcıdır", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenant();
  try {
    await loginAsIsolatedOwner(page, baseURL!, subdomain, email);
    await page.goto(tenantUrl(baseURL!, subdomain, "/analytics"));

    await page.getByRole("button", { name: "Bugünün Sipariş Sayısı widget'ını gizle" }).click();
    await expect(widgetTitle(page, "Bugünün Sipariş Sayısı")).toBeHidden();
    await expect(page.getByRole("button", { name: "Bugünün Sipariş Sayısı", exact: true })).toBeVisible();

    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(widgetTitle(page, "Bugünün Sipariş Sayısı")).toBeHidden();

    await page.getByRole("button", { name: "Bugünün Sipariş Sayısı", exact: true }).click();
    await expect(widgetTitle(page, "Bugünün Sipariş Sayısı")).toBeVisible();

    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(widgetTitle(page, "Bugünün Sipariş Sayısı")).toBeVisible();
  } finally {
    await deleteTenant(tenantId);
  }
});

test("widget sürükle-bırak sıralaması kalıcı olur", async ({ page, baseURL }) => {
  const { tenantId, subdomain, email } = await createIsolatedTenant();
  try {
    await loginAsIsolatedOwner(page, baseURL!, subdomain, email);
    await page.goto(tenantUrl(baseURL!, subdomain, "/analytics"));

    const revenueCard = page.locator('[data-slot="card"]').filter({ has: widgetTitle(page, "Bugünün Cirosu") });
    const orderCountCard = page.locator('[data-slot="card"]').filter({ has: widgetTitle(page, "Bugünün Sipariş Sayısı") });

    async function revenueIsAboveOrderCount(): Promise<boolean> {
      const revenueBox = await revenueCard.boundingBox();
      const orderCountBox = await orderCountCard.boundingBox();
      if (!revenueBox || !orderCountBox) throw new Error("kart konumu alınamadı");
      return revenueBox.y < orderCountBox.y || (revenueBox.y === orderCountBox.y && revenueBox.x < orderCountBox.x);
    }

    const startedAbove = await revenueIsAboveOrderCount();
    const [aboveCard, belowCard] = startedAbove ? [revenueCard, orderCountCard] : [orderCountCard, revenueCard];
    const aboveHandle = aboveCard.locator("button").first();
    const belowHandle = belowCard.locator("button").first();
    const fromBox = await aboveHandle.boundingBox();
    const toBox = await belowHandle.boundingBox();
    if (!fromBox || !toBox) throw new Error("drag handle konumu alınamadı");

    await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2 + 10, { steps: 5 });
    await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2 + 20, { steps: 10 });
    await page.mouse.up();

    await expect.poll(revenueIsAboveOrderCount, { timeout: 10_000 }).toBe(!startedAbove);

    await page.waitForLoadState("networkidle");
    await page.reload();
    expect(await revenueIsAboveOrderCount()).toBe(!startedAbove);
  } finally {
    await deleteTenant(tenantId);
  }
});
