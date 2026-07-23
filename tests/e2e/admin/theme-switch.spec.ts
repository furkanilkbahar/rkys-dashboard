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

test("S29: admin temayı değiştirince doğru data-theme uygulanır", async ({ page, baseURL }) => {
  try {
    await loginAsAcmeOwner(page, baseURL!);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "warm-luxury");

    await page.goto(acmeUrl(baseURL!, "/admin/settings"));
    await page.getByRole("combobox", { name: "Tema" }).click();
    await page.getByRole("option", { name: "Sage Bistro" }).click();

    // ThemeCard router.refresh() çağırıyor — kök layout tenant'ın
    // theme_key'ini yeniden okuyup data-theme'i günceller.
    await expect(page.locator("html")).toHaveAttribute("data-theme", "sage-bistro", { timeout: 10_000 });

    // Guest menü tarafı da aynı tenant'ın theme_key'ini görür.
    await page.goto(acmeUrl(baseURL!, "/masa"));
    await expect(page.locator("html")).toHaveAttribute("data-theme", "sage-bistro");
  } finally {
    await serviceClient().from("tenant_settings").update({ theme_key: "warm-luxury" }).eq("tenant_id", ACME_TENANT_ID);
  }
});
