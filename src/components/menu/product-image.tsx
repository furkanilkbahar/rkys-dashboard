import Image from "next/image";

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
