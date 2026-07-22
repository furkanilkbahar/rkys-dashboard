import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { betaUrl, loginAsBetaOwner, loginAsPlatformAdmin } from "../helpers/tenant";

// Aynı sabit lokal demo anahtarları — session-panel.spec.ts'deki desenle aynı.
function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

let createdTicketId: string | null = null;

test.afterEach(async () => {
  // Her koşum kendi ticket'ını silsin diye — beta paylaşılan bir tenant,
  // temizlenmezse sonraki koşumlarda "Beta Restoran" metni birden fazla
  // ticket'ta eşleşip strict-mode ihlaline yol açar.
  if (createdTicketId) {
    await serviceClient().from("support_tickets").delete().eq("id", createdTicketId);
    createdTicketId = null;
  }
});

test("S15: destek ticket — tenant açar → Süper Admin yanıtlar → durum akışı", async ({ page, browser, baseURL }) => {
  const subject = `Test destek talebi ${Date.now()}`;

  await loginAsBetaOwner(page, baseURL!);
  await page.goto(betaUrl(baseURL!, "/admin/support"));
  await page.getByLabel("Konu").fill(subject);
  await page.getByLabel("Mesaj").fill("Menümde bir sorun var, yardımcı olur musunuz?");
  await page.getByRole("button", { name: "Ticket Oluştur" }).click();
  await expect(page).toHaveURL(/\/admin\/support\//);
  await expect(page.getByText("Açık")).toBeVisible();
  createdTicketId = page.url().split("/").pop() ?? null;

  // Süper Admin ayrı bir tarayıcı bağlamında (farklı oturum çerezi) yanıtlar.
  const platformContext = await browser.newContext();
  const platformPage = await platformContext.newPage();
  try {
    await loginAsPlatformAdmin(platformPage, baseURL!);
    await platformPage.goto(`${baseURL}/platform/support`);
    await expect(platformPage.getByText(subject)).toBeVisible();

    await platformPage.goto(`${baseURL}/platform/support/${createdTicketId}`);
    await expect(platformPage.getByText("Beta Restoran")).toBeVisible();
    await platformPage.getByPlaceholder("Yanıtınızı yazın...").fill("Elbette, hemen bakıyoruz.");
    await platformPage.getByRole("button", { name: "Gönder" }).click();
    await expect(platformPage.getByText("Yanıtlandı")).toBeVisible();
  } finally {
    await platformContext.close();
  }

  // Tenant tarafta yanıt görünür, tenant çözüldü olarak işaretler.
  await page.reload();
  await expect(page.getByText("Elbette, hemen bakıyoruz.")).toBeVisible();
  await expect(page.getByText("Yanıtlandı")).toBeVisible();
  await page.getByRole("button", { name: "Çözüldü Olarak İşaretle" }).click();
  await expect(page.getByText("Çözüldü")).toBeVisible();
});
