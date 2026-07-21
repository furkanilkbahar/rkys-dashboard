import { createHash } from "crypto";

import { expect, test } from "@playwright/test";

import { serviceRoleClient } from "../../helpers/testClients";
import { acmeUrl } from "../helpers/tenant";

test("misafir kartla öder: mock checkout → imzalı webhook → oturum kapanır", async ({ page, baseURL }) => {
  await page.goto(acmeUrl(baseURL!, "/masa/t/demo-acme-table-5"));
  await expect(page).toHaveURL(/\/masa$/);

  const coffeeCard = page.locator('[data-slot="card"]').filter({ hasText: "Filtre Kahve" });
  await coffeeCard.getByRole("button", { name: "Sepete ekle" }).click();
  await page.getByRole("button", { name: "Siparişi Gönder" }).click();
  await expect(page.getByText("Siparişiniz alındı.")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Oturumum" }).click();
  await page.getByRole("button", { name: "Kartla Öde" }).click();
  await expect(page).toHaveURL(/\/masa\/pay\/mock\//);
  await expect(page.getByText("Sahte Ödeme Sayfası")).toBeVisible();

  await page.getByRole("button", { name: "Ödemeyi Onayla" }).click();
  await expect(page).toHaveURL(/\/masa$/);

  // Webhook'un gerçekten işlendiğinin (RPC'nin çağrıldığının) kanıtı: oturum
  // veritabanında 'payment' sebebiyle kapanmış olmalı — Faz 1-2 misafir
  // UI'ında "oturum kapandı" ekranı henüz yok, bu yüzden en güvenilir
  // doğrulama DB seviyesinde.
  const service = serviceRoleClient();
  const { data: table } = await service
    .from("tables")
    .select("id")
    .eq("qr_token_hash", createHash("sha256").update("demo-acme-table-5").digest("hex"))
    .single();
  const { data: session } = await service
    .from("table_sessions")
    .select("status, close_reason")
    .eq("table_id", table!.id)
    .order("opened_at", { ascending: false })
    .limit(1)
    .single();
  expect(session?.status).toBe("closed");
  expect(session?.close_reason).toBe("payment");
});
