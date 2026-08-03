import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

const ACME_TENANT_ID = "00000000-0000-4000-8000-000000000001";

function serviceClient() {
  return createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  );
}

/** `<html>` üzerinde çözülmüş bir CSS custom property'sini okur. */
async function cssVar(page: import("@playwright/test").Page, name: string): Promise<string> {
  return (
    await page.evaluate((prop) => getComputedStyle(document.documentElement).getPropertyValue(prop), name)
  ).trim();
}

// D88 (Faz 21) ile davranış sözleşmesi değişti: tenant teması ARTIK yalnızca
// misafir yüzeyini (data-surface="guest") boyar. Önceki sürümde data-theme kök
// <html>'e basıldığı ve tüm token dosyaları global import edildiği için tenant'ın
// menü teması admin panelini de boyuyordu — bu test o davranışı doğruluyordu.
// Test SİLİNMEDİ, kapsamı büyüdü: tema değişimi hâlâ menüde doğrulanıyor,
// üstüne aynı değişikliğin admin'e SIZMADIĞI doğrulanıyor.
test("S29: tenant teması misafir menüsünde uygulanır, admin'e sızmaz", async ({ page, baseURL }) => {
  try {
    await loginAsAcmeOwner(page, baseURL!);

    // Admin uygulama chrome'udur; tenant teması değil RKYS ürün token'ları geçerli.
    await expect(page.locator("html")).toHaveAttribute("data-surface", "app");
    const adminPrimaryBefore = await cssVar(page, "--primary");
    expect(adminPrimaryBefore).not.toBe("");

    // Misafir menüsü tenant temasını taşır (migration 0090 sonrası seed: kagit).
    await page.goto(acmeUrl(baseURL!, "/masa"));
    await expect(page.locator("html")).toHaveAttribute("data-surface", "guest");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "kagit");
    const guestPrimaryBefore = await cssVar(page, "--primary");

    // Temayı değiştir.
    await page.goto(acmeUrl(baseURL!, "/admin/settings"));
    await page.getByRole("combobox", { name: "Tema" }).click();
    await page.getByRole("option", { name: "Kor" }).click();

    // ThemeCard router.refresh() çağırıyor — kök layout tenant'ın theme_key'ini
    // yeniden okur, `data-theme` HER yüzeyde güncellenir. Bu aynı zamanda
    // kaydın tamamlandığının beklemesidir: aşağıdaki izolasyon kontrolü ancak
    // yeni değer yansıdıktan sonra anlamlı.
    await expect(page.locator("html")).toHaveAttribute("data-theme", "kor", { timeout: 10_000 });
    await expect(page.locator("html")).toHaveAttribute("data-surface", "app");

    // İZOLASYON (D88): data-theme değişti ama admin uygulama chrome'u olduğu
    // için GÖRSEL ETKİ YOK — tenant tema bloğu [data-surface="guest"] altında.
    expect(await cssVar(page, "--primary")).toBe(adminPrimaryBefore);

    // Misafir tarafında değişiklik GERÇEKTEN uygulanmış olmalı.
    await page.goto(acmeUrl(baseURL!, "/masa"));
    await expect(page.locator("html")).toHaveAttribute("data-theme", "kor");
    const guestPrimaryAfter = await cssVar(page, "--primary");
    expect(guestPrimaryAfter).not.toBe(guestPrimaryBefore);
  } finally {
    await serviceClient().from("tenant_settings").update({ theme_key: "kagit" }).eq("tenant_id", ACME_TENANT_ID);
  }
});
