import { getTranslations } from "next-intl/server";

import type { MenuProduct } from "@/lib/data/menu";
import { formatPrice } from "@/lib/utils/currency";

import { AddToCart } from "./add-to-cart";
import { ProductImage } from "./product-image";

/**
 * Faz 21 Adım 0 — ürün kartı.
 *
 * SERVER COMPONENT. Eskiden bütün kart "use client" idi ve her karta framer-motion
 * mount animasyonu bindiriliyordu; ızgaranın tamamı JS taşıyordu. Artık yalnızca
 * <AddToCart /> yaprağı hidrate olur, giriş animasyonu CSS'tir (menu.css).
 *
 * Kart anatomisi (§2.2 kural 4): görsel → ad → detay ipucu → fiyat → sepete
 * ekleme affordance'ı. Fiyat görsel olarak ayrıcalıklıdır — vurgu renginde,
 * kalın, tabular (§2.2 kural 5).
 *
 * `textFirst`: kategoride fotoğraflı ürün oranı %50'nin altındaysa CategorySection
 * bunu true geçer — görsel bloğu hiç çizilmez, tipografi büyür (kabul kriteri 2).
 */
export async function ProductCard({
  product,
  currency,
  textFirst = false,
  priority = false,
}: {
  product: MenuProduct;
  currency: string;
  textFirst?: boolean;
  priority?: boolean;
}) {
  const t = await getTranslations("menu.product");

  const displayPrice =
    product.variants.length > 0
      ? Math.min(...product.variants.map((v) => v.priceMinor))
      : product.priceMinor;

  // MenuProduct'ta açıklama/gramaj alanı yok — uydurmuyoruz, elimizdeki
  // gerçek bilgiyi (varyant/ekstra sayısı) ipucu olarak gösteriyoruz.
  const hints: string[] = [];
  if (product.variants.length > 0) hints.push(t("variantCount", { count: product.variants.length }));
  if (product.extras.length > 0) hints.push(t("extraCount", { count: product.extras.length }));

  return (
    <article
      // §5: `data-slot="card"` bir LOCATOR YÜZEYİDİR — menü E2E'leri ürün
      // kartını bununla buluyor (ör. session-panel.spec.ts:63). Kart artık
      // shadcn <Card> değil ama sözleşme korunuyor; keyfi değiştirilmez.
      data-slot="card"
      data-testid="product-card"
      // TELEFONDA SATIR, `sm:`TEN İTİBAREN KART.
      // Telefonda iki sütunluk ızgara hem yatay kaydırma üretiyordu hem de
      // ekrana 2-3 üründen fazlası sığmıyordu. Satır düzeni (solda küçük
      // görsel, sağda metin) aynı ekrana 6-7 ürün sığdırır ve ürün adına
      // tam genişlik verir. Duyarlı geçiş SALT CSS — bileşen Server
      // Component kalır, hiçbir JS eklenmez.
      className="menu-card flex overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--card)] sm:flex-col"
    >
      {!textFirst && (
        <div className="shrink-0 p-[7px] sm:pb-0">
          <ProductImage
            src={product.imageUrl}
            name={product.name}
            priority={priority}
            boxClassName="size-[84px] sm:aspect-[4/3] sm:size-auto sm:w-full"
          />
        </div>
      )}

      <div
        className={`flex min-w-0 flex-1 flex-col gap-1 py-2 pr-3 sm:gap-1.5 sm:px-3 sm:py-[calc(10px*var(--dens))] ${
          textFirst ? "pl-3" : "pl-2 sm:pl-3"
        }`}
      >
        <h3
          className={`font-[family-name:var(--t-display)] leading-tight ${
            textFirst ? "text-[1.05rem] sm:text-[1.16rem]" : "text-[0.98rem] sm:text-[1.04rem]"
          }`}
          style={{ fontWeight: "var(--t-card-w)", letterSpacing: "var(--t-display-tr)" }}
        >
          {product.name}
        </h3>

        {hints.length > 0 && (
          <p className="text-[11.5px] leading-snug text-[var(--fg-faint)]">{hints.join(" · ")}</p>
        )}

        {/* `flex-wrap`: AddToCart açılınca seçenek paneli (w-full) kendi
            satırına iner — fiyatın yanına sıkışmaz. */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-1.5 sm:pt-2">
          <span
            className="min-w-0 flex-1 tabular-nums tracking-tight text-[var(--accent)]"
            style={{ fontWeight: "var(--t-price-w)", fontSize: "1rem" }}
          >
            {product.variants.length > 0
              ? t("priceFrom", { price: formatPrice(displayPrice, currency) })
              : formatPrice(displayPrice, currency)}
          </span>
          <AddToCart product={product} currency={currency} />
        </div>
      </div>
    </article>
  );
}
