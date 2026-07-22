import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// Aynı sabit lokal demo anahtarları — session-panel.spec.ts'deki desenle aynı.
function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

test("public /status sayfası açılır, aktif olay görünür", async ({ page, baseURL }) => {
  const service = serviceClient();
  const title = `Test kesintisi ${Date.now()}`;
  const { data: incident } = await service.from("incidents").insert({ title, status: "investigating" }).select("id").single();
  await service.from("incident_updates").insert({ incident_id: incident!.id, body: "Sorunu araştırıyoruz." });

  try {
    // chromium-desktop ve mobile-safari bu spec'i paralel çalıştırır ve
    // incidents global (tenant'a özgü değil) bir tablo — her iki projenin
    // kendi oluşturduğu olay AYNI ANDA sayfada görünebilir. Bu yüzden
    // doğrulama sayfa genelinde değil, kendi kartımıza (benzersiz başlıkla)
    // taranarak yapılır.
    await page.goto(`${baseURL}/status`);
    await expect(page.getByText("Tüm sistemler çalışıyor")).toBeVisible();
    const card = page.locator('[data-slot="card"]').filter({ hasText: title });
    await expect(card).toBeVisible();
    await expect(card.getByText("İnceleniyor")).toBeVisible();
    await expect(card.getByText("Sorunu araştırıyoruz.")).toBeVisible();
  } finally {
    await service.from("incidents").delete().eq("id", incident!.id);
  }
});
