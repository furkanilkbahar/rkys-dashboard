import { expect, test } from "@playwright/test";

test("S56/S57: ana sayfa gerçek fiyat, modül vitrini ve entegrasyon şeridini gösterir", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`);

  await expect(page.getByText("Başlangıç").first()).toBeVisible();
  await expect(page.getByText("₺499").first()).toBeVisible();
  await expect(page.getByText("Sınırsız masa").first()).toBeVisible();

  await expect(page.getByText("İhtiyacınız olan modülü açın")).toBeVisible();
  await expect(page.getByText("Vardiya, gün sonu ve kasa raporları")).toBeVisible();

  await expect(page.getByText("Zaten kullandığınız araçlarla çalışır")).toBeVisible();
  await expect(page.getByText("Yemeksepeti").first()).toBeVisible();

  // Faz 23: entegrasyonlar artık düz bir isim şeridi değil, türüne göre
  // gruplu. Grup başlıkları hangi ismin ne olduğunu taşıyor.
  const integrations = page.locator("#entegrasyonlar");
  await expect(integrations.getByRole("heading", { name: "Pazar yerleri" })).toBeVisible();
  await expect(integrations.getByRole("heading", { name: "Muhasebe" })).toBeVisible();

  // Bölüm SIRASI da sözleşmenin parçası: entegrasyonlar hero'nun hemen
  // altındaydı, ürün anlatılmadan marka adı gösteriyordu. Artık modül
  // vitrininin ALTINDA. DOM sırası okuma sırasıdır.
  const sectionOrder = await page.evaluate(() =>
    [...document.querySelectorAll("main section[id], main div[id]")].map((el) => el.id),
  );
  expect(sectionOrder.indexOf("entegrasyonlar")).toBeGreaterThan(sectionOrder.indexOf("moduller"));

  // Faz 21 Adım 2: §2.4'ün bölüm iskeleti uygulandı ve "Neden RKYS Dashboard"
  // güven bölümü kaldırıldı — içerdiği gerçek iddialar (tenant izolasyonu,
  // modül disiplini, trial, self-hosted) artık bölünmüş içerik bölümlerine ve
  // lisans bölümüne dağıldı. Yerine §2.4'ün AÇIKÇA istediği şey doğrulanıyor:
  // ikinci satış modeli (lifetime/self-hosted lisans) sayfada görünür olmalı,
  // dipnota gömülmemeli.
  await expect(page.getByRole("heading", { name: /lisansı satın alın/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lisans için iletişime geçin" })).toBeVisible();
});

test("Faz 23: 'Kimler kullanıyor' bölümü işletme TİPLERİNİ anlatır, uydurma müşteri adı içermez", async ({
  page,
  baseURL,
}) => {
  await page.goto(`${baseURL}/`);

  const audience = page.locator("#kimler-icin");
  await expect(audience.getByRole("heading", { name: "Tek bir kafeden şubeli zincire" })).toBeVisible();
  await expect(audience.getByRole("heading", { name: "Üçüncü nesil kahveci" })).toBeVisible();
  // `exact` ŞART: bölüm başlığı "Tek bir kafeden şubeli zincire" ve
  // `getByRole` erişilebilir adı ALT DİZE olarak eşliyor — exact olmadan
  // kart başlığıyla bölüm başlığı birlikte eşleşip strict mode ihlali veriyor.
  await expect(audience.getByRole("heading", { name: "Şubeli zincir", exact: true })).toBeVisible();

  // DESIGN.md "uydurma iddia yasak": bu bölüm bir referans/testimonial
  // bölümüne DÖNÜŞTÜRÜLMEMELİ. Test bunu koruyor — sayfaya sahte bir
  // müşteri/logo şeridi eklenirse burası kırılır.
  await expect(page.getByText(/referans/i)).toHaveCount(0);
  await expect(page.getByText(/müşterilerimiz/i)).toHaveCount(0);
});

test("D96: 'Demo' planı ana sayfada görünmez ama kayıt formunda seçilebilir", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`);

  // Vitrinde yok: `is_public = false` olan plan fiyat tablosuna düşmez.
  const pricing = page.locator("#fiyatlandirma");
  await expect(pricing.getByText("Demo", { exact: true })).toHaveCount(0);
  await expect(pricing.getByText("Başlangıç", { exact: true })).toBeVisible();

  // Kayıt formunda var: "seçilebilirlik" ile "vitrinde olma" ayrı sorular.
  await page.goto(`${baseURL}/kayit`);
  await page.getByLabel("Plan").click();
  await expect(page.getByRole("option", { name: /^Demo/ })).toBeVisible();
});

test("S59: blog sayfası boş durum gösterir", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/blog`);
  await expect(page.getByRole("heading", { name: "Blog" })).toBeVisible();
  await expect(page.getByText("Yakında burada olacağız")).toBeVisible();
});
