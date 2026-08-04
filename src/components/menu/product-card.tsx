import { getTranslations } from "next-intl/server";

import type { MenuProduct } from "@/lib/data/menu";
import { formatPrice } from "@/lib/utils/currency";

import { ProductImage } from "./product-image";
import { ProductInteractive } from "./product-interactive";

/**
 * Faz 21 Adım 0 — ürün kartı. Faz 22'de açıklama + detaya giriş eklendi.
 *
 * SERVER COMPONENT. Kart kabuğu, görseli ve metni sunucuda render edilir;
 * yalnızca <ProductInteractive /> yaprağı hidrate olur (dokunma → detay
 * katmanı, adet stepper'ı, sepete ekleme onayı). Giriş animasyonu CSS.
 *
 * Kart anatomisi (§2.2 kural 4): görsel → ad → AÇIKLAMA → fiyat → sepete
 * ekleme affordance'ı. Fiyat görsel olarak ayrıcalıklıdır (§2.2 kural 5).
 *
 * `textFirst`: kategoride fotoğraflı ürün oranı %50'nin altındaysa
 * CategorySection bunu true geçer — görsel bloğu hiç çizilmez.
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

  // Açıklama varsa o gösterilir (müşterinin gerçekten aradığı bilgi);
  // yoksa elimizdeki tek gerçek bilgiye düşülür — seçenek/ekstra sayısı.
  // Hiçbir şey uydurulmaz.
  const hints: string[] = [];
  if (product.variants.length > 0) hints.push(t("variantCount", { count: product.variants.length }));
  if (product.extras.length > 0) hints.push(t("extraCount", { count: product.extras.length }));
  const secondary = product.description ?? (hints.length > 0 ? hints.join(" · ") : null);

  return (
    <article
      // §5: `data-slot="card"` bir LOCATOR YÜZEYİDİR — menü E2E'leri ürün
      // kartını bununla buluyor (ör. session-panel.spec.ts:63). Kart artık
      // shadcn <Card> değil ama sözleşme korunuyor; keyfi değiştirilmez.
      data-slot="card"
      data-testid="product-card"
      data-product-id={product.id}
      // TELEFONDA SATIR, `sm:`TEN İTİBAREN KART. Telefonda iki sütunluk
      // ızgara hem yatay kaydırma üretiyordu hem de ekrana 2-3 üründen
      // fazlası sığmıyordu. Duyarlı geçiş SALT CSS.
      className="menu-card flex items-stretch overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--card)] sm:flex-col"
    >
      <ProductInteractive product={product} currency={currency}>
        {!textFirst && (
          <div className="shrink-0 sm:p-[7px] sm:pb-0">
            <ProductImage
              src={product.imageUrl}
              name={product.name}
              priority={priority}
              boxClassName="size-[84px] sm:aspect-[4/3] sm:size-auto sm:w-full"
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 sm:justify-start sm:px-3 sm:pt-2.5">
          <h3
            className={`font-[family-name:var(--t-display)] leading-tight ${
              textFirst ? "text-[1.05rem] sm:text-[1.16rem]" : "text-[0.98rem] sm:text-[1.04rem]"
            }`}
            style={{ fontWeight: "var(--t-card-w)", letterSpacing: "var(--t-display-tr)" }}
          >
            {product.name}
          </h3>

          {secondary && (
            <p className="line-clamp-1 text-[12px] leading-snug text-[var(--fg-faint)] sm:line-clamp-2">
              {secondary}
            </p>
          )}

          <span
            className="tabular-nums tracking-tight text-[var(--accent)]"
            style={{ fontWeight: "var(--t-price-w)", fontSize: "1rem" }}
          >
            {product.variants.length > 0
              ? t("priceFrom", { price: formatPrice(displayPrice, currency) })
              : formatPrice(displayPrice, currency)}
          </span>
        </div>
      </ProductInteractive>
    </article>
  );
}
