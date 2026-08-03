"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import type { MenuProduct } from "@/lib/data/menu";
import { lineKey, useCartStore } from "@/lib/store/cart";
import { formatPrice } from "@/lib/utils/currency";

/**
 * Faz 21 Adım 0 kabul kriteri 5 — hidrasyon disiplini.
 *
 * Sepete ekleme YAPRAK bileşendir: kart kabuğu, görseli ve metni Server
 * Component olarak kalır, yalnızca bu düğme hidrate olur. Eskiden bütün
 * ProductCard "use client" idi ve ızgaranın tamamı JS taşıyordu.
 *
 * Varyant/ekstra olan ürünlerde seçim paneli aynı yaprağın içinde açılır —
 * ayrı bir sheet primitive'i yüklenmez.
 */
export function AddToCart({ product, currency }: { product: MenuProduct; currency: string }) {
  const t = useTranslations("menu.product");
  const addLine = useCartStore((state) => state.addLine);
  const lines = useCartStore((state) => state.lines);

  const hasDetails = product.variants.length > 0 || product.extras.length > 0;
  const [open, setOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    product.variants.find((v) => v.isOrderable)?.id ?? product.variants[0]?.id ?? null,
  );
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);

  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId) ?? null;

  // Bu ürünün sepetteki toplam adedi — stepper göstermek için.
  const quantityInCart = useMemo(
    () => lines.filter((l) => l.productId === product.id).reduce((sum, l) => sum + l.quantity, 0),
    [lines, product.id],
  );

  const canAdd = product.variants.length > 0 ? selectedVariant?.isOrderable === true : product.isOrderable;

  function commit() {
    if (!canAdd) return;
    const unitPrice = selectedVariant ? selectedVariant.priceMinor : product.priceMinor;
    const chosenExtras = product.extras.filter((e) => selectedExtraIds.includes(e.id));

    addLine({
      key: lineKey(product.id, selectedVariantId, selectedExtraIds),
      productId: product.id,
      variantId: selectedVariantId,
      productName: product.name,
      variantName: selectedVariant?.name ?? null,
      unitPriceMinor: unitPrice + chosenExtras.reduce((sum, e) => sum + e.priceMinor, 0),
      extraIds: selectedExtraIds,
      extraNames: chosenExtras.map((e) => e.name),
    });

    setSelectedExtraIds([]);
    setOpen(false);
  }

  // RULES #23: stoğu biten ürün sepete eklenemez (sunucu tarafı kontrolü
  // submitOrder'da ayrıca var — burada yalnızca affordance gizlenir).
  if (!product.isOrderable) {
    return (
      <span className="rounded-full border border-[var(--line)] px-2 py-1 text-[10.5px] font-semibold tracking-wider uppercase text-[var(--fg-faint)]">
        {t("soldOut")}
      </span>
    );
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        {quantityInCart > 0 && (
          <span
            className="tabular-nums text-xs font-semibold text-[var(--accent)]"
            aria-label={t("inCart", { count: quantityInCart })}
          >
            {quantityInCart}×
          </span>
        )}
        <button
          type="button"
          onClick={() => (hasDetails ? setOpen((v) => !v) : commit())}
          aria-label={hasDetails ? t("chooseOptions", { name: product.name }) : t("addNamed", { name: product.name })}
          aria-expanded={hasDetails ? open : undefined}
          className="flex size-9 items-center justify-center rounded-full bg-[var(--accent)] text-xl leading-none text-[var(--accent-fg)] transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-90"
        >
          {hasDetails ? "⋯" : "+"}
        </button>
      </div>

      {open && hasDetails && (
        <div className="mt-3 flex flex-col gap-3 border-t border-[var(--line)] pt-3 text-sm">
          {product.variants.length > 0 && (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="sr-only">{t("variants")}</legend>
              {product.variants.map((variant) => (
                <label key={variant.id} className="flex items-center justify-between gap-2 text-[var(--fg-muted)]">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`variant-${product.id}`}
                      checked={selectedVariantId === variant.id}
                      disabled={!variant.isOrderable}
                      onChange={() => setSelectedVariantId(variant.id)}
                    />
                    {variant.name}
                  </span>
                  <span className="tabular-nums">
                    {variant.isOrderable ? formatPrice(variant.priceMinor, currency) : t("soldOut")}
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {product.extras.length > 0 && (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="sr-only">{t("extras")}</legend>
              {product.extras.map((extra) => (
                <label key={extra.id} className="flex items-center justify-between gap-2 text-[var(--fg-muted)]">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedExtraIds.includes(extra.id)}
                      disabled={!extra.isOrderable}
                      onChange={() =>
                        setSelectedExtraIds((prev) =>
                          prev.includes(extra.id) ? prev.filter((id) => id !== extra.id) : [...prev, extra.id],
                        )
                      }
                    />
                    + {extra.name}
                  </span>
                  <span className="tabular-nums">
                    {extra.isOrderable ? formatPrice(extra.priceMinor, currency) : t("soldOut")}
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          <button
            type="button"
            disabled={!canAdd}
            onClick={commit}
            className="min-h-11 rounded-full bg-[var(--accent)] text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-50"
          >
            {t("addToCart")}
          </button>
        </div>
      )}
    </>
  );
}
