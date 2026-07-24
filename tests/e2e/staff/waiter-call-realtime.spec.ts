import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { acmeUrl } from "../helpers/tenant";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

// Paylaşılan "acme" tenant'ında "Masa 3" için açık kalan tüm çağrıları
// temizler — testin kendisi normalde "Karşılandı" ile kapatır, ama test
// erken bir adımda (ör. Realtime zaman aşımı) başarısız olursa çağrı açık
// kalır ve bir sonraki koşumun `.first()` locator'ını yanlış satırla
// eşleştirebilir (bkz. TESTING.md §7 geçmişi, Faz 10 kapanışında gözlemlendi).
async function clearOpenCallsForTable3() {
  const service = serviceClient();
  const { data: table } = await service.from("tables").select("id").eq("label", "Masa 3").limit(1).maybeSingle();
  if (!table) return;
  const { data: sessions } = await service.from("table_sessions").select("id").eq("table_id", table.id);
  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (sessionIds.length === 0) return;
  await service.from("waiter_calls").delete().eq("status", "open").in("table_session_id", sessionIds);
}

test("misafirin garson çağrısı garson panelinde canlı görünür ve karşılanabilir", async ({ browser, baseURL }) => {
  await clearOpenCallsForTable3();
  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  try {
    await staffPage.goto(acmeUrl(baseURL!, "/admin/login"));
    await staffPage.getByLabel("E-posta").fill("owner@acme.test");
    await staffPage.getByLabel("Şifre").fill("password123");
    await staffPage.getByRole("button", { name: "Giriş yap" }).click();
    await staffPage.waitForURL(/\/admin$/);
    await staffPage.goto(acmeUrl(baseURL!, "/waiter"));

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    try {
      await guestPage.goto(acmeUrl(baseURL!, "/masa/t/demo-acme-table-3"));
      await expect(guestPage).toHaveURL(/\/masa$/);

      await guestPage.getByRole("button", { name: "Garson Çağır" }).click();
      await guestPage.getByText("Su İstiyorum").click();
      await expect(guestPage.getByText("Garson çağrıldı.")).toBeVisible();

      // Realtime + otomatik yenileme ile garson panelinde belirir (Masa 3 —
      // clearOpenCallsForTable3 sayesinde bu testin kendi çağrısından
      // başkası olmamalı).
      const callCard = staffPage.locator('[data-slot="card"]').filter({ hasText: "Masa 3" }).first();
      await expect(callCard).toBeVisible({ timeout: 15_000 });
      await expect(callCard.getByText("Su İstiyorum")).toBeVisible();

      await callCard.getByRole("button", { name: "Karşılandı" }).click();
      await expect(callCard).toHaveCount(0, { timeout: 15_000 });
    } finally {
      await guestContext.close();
    }
  } finally {
    await staffContext.close();
    await clearOpenCallsForTable3();
  }
});
