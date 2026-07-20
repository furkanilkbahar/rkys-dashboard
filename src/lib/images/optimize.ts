import "server-only";

import sharp from "sharp";

const MAX_WIDTH = 1600;
const WEBP_QUALITY = 80;

/**
 * Storage'a Pro-plan-only image transform API'si yerine server-side sharp
 * kullanılıyor (D67 self-hosted/local dev parite). Menü fotoğrafları
 * WebP'ye çevrilir + genişlik sınırlanır, orijinal dosya boyutu/formatı
 * ne olursa olsun tutarlı bir çıktı üretir.
 */
export async function optimizeMenuImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // EXIF orientation'a göre düzeltir, sonra EXIF atılır
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}
