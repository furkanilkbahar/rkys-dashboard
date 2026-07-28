import "server-only";

import Vips from "wasm-vips";

const MAX_WIDTH = 1600;
const WEBP_QUALITY = 80;

// sharp (libvips native binding) Vercel'in serverless paketleyicisiyle
// uyuşmuyor — libvips'in .so dosyaları versiyonlu symlink olarak dağıtılıyor,
// Vercel deploy paketi hiçbir symlink'e izin vermiyor (bkz. DECISIONS.md).
// wasm-vips aynı libvips'i WebAssembly'e derliyor: tek taşınabilir .wasm
// dosyası, native binary/symlink derdi olmadan hem Vercel hem Docker'da
// aynı şekilde çalışır.
let vipsPromise: ReturnType<typeof Vips> | null = null;

function getVips() {
  vipsPromise ??= Vips();
  return vipsPromise;
}

/**
 * Storage'a Pro-plan-only image transform API'si yerine server-side
 * wasm-vips kullanılıyor (D67 self-hosted/local dev parite). Menü
 * fotoğrafları WebP'ye çevrilir + genişlik sınırlanır, orijinal dosya
 * boyutu/formatı ne olursa olsun tutarlı bir çıktı üretir.
 */
export async function optimizeMenuImage(input: Buffer): Promise<Buffer> {
  const vips = await getVips();

  // thumbnailBuffer varsayılan olarak EXIF orientation'a göre otomatik
  // döndürür (sharp'ın .rotate() eşdeğeri), size: down ile withoutEnlargement.
  using thumbnail = vips.Image.thumbnailBuffer(input, MAX_WIDTH, {
    size: vips.Size.down,
  });

  const output = thumbnail.writeToBuffer(".webp", { Q: WEBP_QUALITY });
  return Buffer.from(output);
}
