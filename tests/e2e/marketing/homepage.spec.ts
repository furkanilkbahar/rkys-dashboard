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

  // Faz 21 Adım 2: §2.4'ün bölüm iskeleti uygulandı ve "Neden RKYS Dashboard"
  // güven bölümü kaldırıldı — içerdiği gerçek iddialar (tenant izolasyonu,
  // modül disiplini, trial, self-hosted) artık bölünmüş içerik bölümlerine ve
  // lisans bölümüne dağıldı. Yerine §2.4'ün AÇIKÇA istediği şey doğrulanıyor:
  // ikinci satış modeli (lifetime/self-hosted lisans) sayfada görünür olmalı,
  // dipnota gömülmemeli.
  await expect(page.getByRole("heading", { name: /lisansı satın alın/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lisans için iletişime geçin" })).toBeVisible();
});

test("S59: blog sayfası boş durum gösterir", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/blog`);
  await expect(page.getByRole("heading", { name: "Blog" })).toBeVisible();
  await expect(page.getByText("Yakında burada olacağız")).toBeVisible();
});
