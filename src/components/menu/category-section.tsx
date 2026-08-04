import type { MenuCategory } from "@/lib/data/menu";
import { cn } from "@/lib/utils/cn";

import { ProductCard } from "./product-card";

// D14: ürün düzeni kategori başına admin tarafından seçilir. Faz 21 bu
// davranışı KORUR — yalnızca boşluklar yoğunluk token'ına bağlandı.
// TELEFONDA HER DÜZEN TEK SÜTUN. D14 (kategori başına düzen seçimi) korunur
// ama yalnızca `sm:`ten itibaren geçerlidir: 400px'lik bir ekranda iki sütun
// hem yatay kaydırma üretiyordu hem de ekrana 2-3 üründen fazlası
// sığmıyordu. Kartın kendisi de telefonda satır düzenine geçer
// (product-card.tsx) — ikisi birlikte ekrana 6-7 ürün sığdırır.
const LAYOUT_CLASSES: Record<MenuCategory["layout"], string> = {
  grid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  list: "flex flex-col",
  showcase: "flex flex-col",
};

/**
 * Faz 21 Adım 0 kabul kriteri 2 — karışık fotoğraf senaryosu.
 *
 * Gerçek hayatta bir kategorinin yarısında fotoğraf olur, yarısında olmaz;
 * yarısı görselli yarısı boş kutulu bir ızgara en çirkin hâlidir. Kural:
 * kategoride fotoğraflı ürün oranı %50'nin ALTINDAYSA o kategori TAMAMEN
 * metin öncelikli düzene geçer. Tutarlılık, kart başına sadakatten iyidir.
 */
const PHOTO_COVERAGE_THRESHOLD = 0.5;

export function CategorySection({
  category,
  currency,
  isFirst = false,
}: {
  category: MenuCategory;
  currency: string;
  isFirst?: boolean;
}) {
  if (category.products.length === 0) {
    return null;
  }

  const withPhoto = category.products.filter((p) => p.imageUrl !== null).length;
  const textFirst = withPhoto / category.products.length < PHOTO_COVERAGE_THRESHOLD;

  return (
    <section
      id={`kategori-${category.id}`}
      className="scroll-mt-28"
      aria-labelledby={`baslik-${category.id}`}
    >
      <h2
        id={`baslik-${category.id}`}
        // Boyut telefonda SABİT, `sm:`ten itibaren tema token'ı: `--t-display-s`
        // (32.8px) telefonda tek başına ekranın %7'sini yiyordu ve ürün
        // sayısını 2 azaltıyordu. Tema kimliği başlıkta font + ağırlık +
        // harf aralığıyla korunur, yalnızca ölçek küçülür.
        className="mb-2 font-[family-name:var(--t-display)] text-[1.45rem] leading-tight sm:mb-[calc(11px*var(--dens))] sm:text-[length:var(--t-display-s)]"
        style={{
          fontWeight: "var(--t-display-w)",
          letterSpacing: "var(--t-display-tr)",
        }}
      >
        {category.name}
      </h2>

      <div
        className={cn(LAYOUT_CLASSES[category.layout])}
        style={{ gap: "calc(11px * var(--dens))" }}
      >
        {category.products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            currency={currency}
            textFirst={textFirst}
            // LCP adayı: ilk kategorinin ilk iki kartı.
            priority={isFirst && index < 2}
          />
        ))}
      </div>
    </section>
  );
}
