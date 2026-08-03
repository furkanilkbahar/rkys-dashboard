import Image from "next/image";

/**
 * Next 16, SSRF koruması gereği ÖZEL/loopback IP'ye çözülen uzak görselleri
 * optimize etmeyi reddediyor ("resolved to private ip"). Yerel geliştirmede
 * Supabase 127.0.0.1'de çalıştığı için tüm menü görselleri 400 dönüyordu.
 * Prod'da host <ref>.supabase.co olduğundan optimizasyon normal çalışır —
 * bu escape hatch YALNIZCA özel IP'li kurulumlarda devreye girer.
 */
const SUPABASE_HOST_IS_PRIVATE = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return false;
  try {
    const { hostname } = new URL(raw);
    return (
      hostname === "localhost" ||
      hostname === "::1" ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    return false;
  }
})();

/**
 * Faz 21 Adım 0 kabul kriteri 2 — görselsiz zarif çökme.
 *
 * Server Component: hiçbir client JS taşımaz.
 *
 * Üç şeyi garanti eder:
 *  1. En-boy oranı HER ZAMAN rezerve edilir → görselli/görselsiz fark CLS
 *     üretmez.
 *  2. Görsel yoksa tema kendi `--placeholder` token'ını kullanır; `--card-2`'den
 *     türetilmez (açık temada neredeyse görünmez oluyordu).
 *  3. Placeholder'da ürün adının baş harfi display fontunda gösterilir —
 *     Türkçe yerel ayarıyla büyütülür, böylece "ısırgan" → "I" değil "İ"... daha
 *     doğrusu i → İ, ı → I doğru eşlenir.
 */
export function ProductImage({
  src,
  name,
  ratio = "4/3",
  sizes = "(max-width: 640px) 45vw, 220px",
  priority = false,
}: {
  src: string | null;
  name: string;
  ratio?: "4/3" | "1/1" | "16/9";
  sizes?: string;
  priority?: boolean;
}) {
  const initial = name.trim().charAt(0).toLocaleUpperCase("tr-TR");

  return (
    <div
      className="relative w-full overflow-hidden rounded-[var(--radius-img)] bg-[var(--placeholder)]"
      style={{ aspectRatio: ratio }}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={SUPABASE_HOST_IS_PRIVATE}
          className="object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center font-[family-name:var(--t-display)] text-[2rem] leading-none text-[var(--placeholder-fg)]"
          style={{ fontWeight: "var(--t-display-w)", letterSpacing: "var(--t-display-tr)" }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
