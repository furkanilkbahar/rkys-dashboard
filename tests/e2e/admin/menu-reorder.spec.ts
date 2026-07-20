import { expect, test } from "@playwright/test";

import { acmeUrl, loginAsAcmeOwner } from "../helpers/tenant";

test("owner kategori kartlarını sürükleyip sıralamayı değiştirebilir", async ({ page, baseURL }) => {
  await loginAsAcmeOwner(page, baseURL!);
  await page.goto(acmeUrl(baseURL!, "/admin/menu"));

  // İsme göre hedefleniyor (pozisyona göre değil) — menu-crud.spec.ts aynı
  // tenant'a paralel yeni kategoriler ekleyebiliyor, .first()/.nth(1) o
  // durumda kırılgan olurdu. "İçecekler" tam eşleşmesi "Sıcak İçecekler"
  // gibi üst dizeleri (menu-crud'un oluşturduğu) yanlışlıkla eşlemez.
  const drinksCard = page.locator('[data-slot="card"]').filter({ has: page.getByText("İçecekler", { exact: true }) });
  const dessertsCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Tatlılar", { exact: true }) });
  await expect(drinksCard).toBeVisible();
  await expect(dessertsCard).toBeVisible();

  async function drinksIsAboveDesserts(): Promise<boolean> {
    const drinksBox = await drinksCard.boundingBox();
    const dessertsBox = await dessertsCard.boundingBox();
    if (!drinksBox || !dessertsBox) throw new Error("kart konumu alınamadı");
    return drinksBox.y < dessertsBox.y;
  }

  // Başlangıç sırası varsayılmaz: chromium-desktop ve mobile-safari aynı
  // paylaşılan lokal DB'ye karşı çalışıyor, hangi proje/testin önce
  // koştuğuna göre sıra zaten ters çevrilmiş olabilir. Üstteki kartın
  // sürüklenip alttakiyle yer değiştirdiği (yani sıranın FLİP olduğu)
  // doğrulanır — mutlak "İçecekler her zaman önce" varsayımı yerine.
  const startedWithDrinksAbove = await drinksIsAboveDesserts();
  const [aboveCard, belowCard] = startedWithDrinksAbove ? [drinksCard, dessertsCard] : [dessertsCard, drinksCard];

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

  await expect.poll(drinksIsAboveDesserts, { timeout: 10_000 }).toBe(!startedWithDrinksAbove);

  // Sürükleme bırakıldıktan sonra optimistic UI hemen güncellenir, ama
  // reorderMenuCategories server action'ı + router.refresh() ağ üzerinden
  // tamamlanmadan reload edilirse (RPC henüz commit olmadan) eski sıra
  // geri gelir — ağın durulmasını bekleyip öyle reload ediyoruz.
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(drinksCard).toBeVisible();
  await expect(dessertsCard).toBeVisible();
  expect(await drinksIsAboveDesserts()).toBe(!startedWithDrinksAbove);
});
