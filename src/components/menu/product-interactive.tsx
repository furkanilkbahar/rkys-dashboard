"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { MenuProduct } from "@/lib/data/menu";
import { lineKey, useCartStore } from "@/lib/store/cart";
import { formatPrice } from "@/lib/utils/currency";

import { ProductImage } from "./product-image";

/**
 * Faz 22 — ürün kartının ETKİLEŞİMLİ yaprağı.
 *
 * Üç eksiği birlikte kapatır:
 *  1. **Detaya giriş yoktu.** Karta dokunmak hiçbir şey yapmıyordu; varyantlı
 *     üründe kartın içinde küçük bir liste açılıyordu, fotoğrafı büyütmek ya
 *     da açıklamayı okumak mümkün değildi. Artık kart bir düğme ve alttan
 *     açılan detay katmanını açıyor.
 *  2. **Adet ayarı menüde yoktu.** Sepette 1'den fazla istemek için `+`ya
 *     defalarca basmak, azaltmak için sepeti açmak gerekiyordu. Kartın
 *     üstünde `− n +` stepper'ı var.
 *  3. **Geri bildirim zayıftı.** Sepete eklendiğinde yalnızca bir sayı
 *     değişiyordu. Artık kısa bir "Eklendi" onayı beliriyor.
 *
 * Kart kabuğu ve metni SERVER COMPONENT kalır — bu bileşen `children` olarak
 * sunucuda render edilmiş içeriği alır, yalnızca etkileşim client'a iner.
 */
export function ProductInteractive({
  product,
  currency,
  children,
}: {
  product: MenuProduct;
  currency: string;
  /** Sunucuda render edilmiş görsel + metin bloğu. */
  children: ReactNode;
}) {
  const t = useTranslations("menu.product");
  const addLine = useCartStore((state) => state.addLine);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const lines = useCartStore((state) => state.lines);

  const hasOptions = product.variants.length > 0 || product.extras.length > 0;
  const [open, setOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  // Seçeneksiz ürünün sepetteki TEK satırı — stepper doğrudan onu yönetir.
  const simpleKey = lineKey(product.id, null, []);
  const simpleLine = lines.find((l) => l.key === simpleKey) ?? null;

  // Seçenekli üründe kartta adet göstermek yanıltıcı olurdu (hangi varyant?),
  // bu yüzden yalnızca toplam gösterilir ve `+` detay katmanını açar.
  const totalInCart = useMemo(
    () => lines.filter((l) => l.productId === product.id).reduce((sum, l) => sum + l.quantity, 0),
    [lines, product.id],
  );

  useEffect(() => {
    if (!justAdded) return;
    const id = setTimeout(() => setJustAdded(false), 1400);
    return () => clearTimeout(id);
  }, [justAdded]);

  // Detay katmanı açıkken arka plan kaymasın.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function addSimple() {
    addLine({
      key: simpleKey,
      productId: product.id,
      variantId: null,
      productName: product.name,
      variantName: null,
      unitPriceMinor: product.priceMinor,
      extraIds: [],
      extraNames: [],
    });
    setJustAdded(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("openDetail", { name: product.name })}
        className="flex min-w-0 flex-1 items-center gap-2.5 p-[7px] text-left sm:flex-col sm:items-stretch sm:gap-0 sm:p-0"
      >
        {children}
      </button>

      <div className="flex shrink-0 items-center gap-1.5 pr-2.5 sm:w-full sm:justify-end sm:px-3 sm:pb-3">
        {justAdded && (
          <span
            role="status"
            className="ops-fade-in rounded-full bg-[var(--accent)]/12 px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]"
          >
            {t("added")}
          </span>
        )}

        {!product.isOrderable ? (
          <span className="rounded-full border border-[var(--line)] px-2 py-1 text-[10.5px] font-semibold tracking-wider text-[var(--fg-faint)] uppercase">
            {t("soldOut")}
          </span>
        ) : !hasOptions && simpleLine ? (
          <Stepper
            quantity={simpleLine.quantity}
            onDecrease={() => setQuantity(simpleKey, simpleLine.quantity - 1)}
            onIncrease={() => setQuantity(simpleKey, simpleLine.quantity + 1)}
            decreaseLabel={t("decrease")}
            increaseLabel={t("increase")}
          />
        ) : (
          <>
            {hasOptions && totalInCart > 0 && (
              <span className="text-xs font-semibold tabular-nums text-[var(--accent)]" aria-label={t("inCart", { count: totalInCart })}>
                {totalInCart}×
              </span>
            )}
            <button
              type="button"
              onClick={() => (hasOptions ? setOpen(true) : addSimple())}
              aria-label={hasOptions ? t("chooseOptions", { name: product.name }) : t("addNamed", { name: product.name })}
              className="flex size-9 items-center justify-center rounded-full bg-[var(--accent)] text-xl leading-none text-[var(--accent-fg)] transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-90"
            >
              {hasOptions ? "⋯" : "+"}
            </button>
          </>
        )}
      </div>

      {open && (
        <ProductDetailSheet
          product={product}
          currency={currency}
          onClose={() => setOpen(false)}
          onAdded={() => setJustAdded(true)}
        />
      )}
    </>
  );
}

function Stepper({
  quantity,
  onDecrease,
  onIncrease,
  decreaseLabel,
  increaseLabel,
}: {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-[var(--line)] p-0.5">
      <button
        type="button"
        onClick={onDecrease}
        aria-label={decreaseLabel}
        className="flex size-8 items-center justify-center rounded-full text-lg leading-none text-[var(--fg)] active:scale-90"
      >
        −
      </button>
      <span className="min-w-[1.25rem] text-center text-sm font-bold tabular-nums">{quantity}</span>
      <button
        type="button"
        onClick={onIncrease}
        aria-label={increaseLabel}
        className="flex size-8 items-center justify-center rounded-full bg-[var(--accent)] text-lg leading-none text-[var(--accent-fg)] active:scale-90"
      >
        +
      </button>
    </div>
  );
}

/**
 * Alttan açılan detay katmanı: büyük görsel, açıklama, seçenekler, adet.
 *
 * Kendi `<dialog>` primitive'ini kullanmaz — misafir yüzeyinin JS bütçesi
 * dar (D89a); basit bir overlay + `Escape` yeterli.
 */
function ProductDetailSheet({
  product,
  currency,
  onClose,
  onAdded,
}: {
  product: MenuProduct;
  currency: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const t = useTranslations("menu.product");
  const addLine = useCartStore((state) => state.addLine);

  const [variantId, setVariantId] = useState<string | null>(
    product.variants.find((v) => v.isOrderable)?.id ?? product.variants[0]?.id ?? null,
  );
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const chosenExtras = product.extras.filter((e) => extraIds.includes(e.id));
  const unitPriceMinor =
    (variant ? variant.priceMinor : product.priceMinor) + chosenExtras.reduce((sum, e) => sum + e.priceMinor, 0);
  const canAdd = product.variants.length > 0 ? variant?.isOrderable === true : product.isOrderable;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function commit() {
    if (!canAdd) return;
    addLine(
      {
        key: lineKey(product.id, variantId, extraIds),
        productId: product.id,
        variantId,
        productName: product.name,
        variantName: variant?.name ?? null,
        unitPriceMinor,
        extraIds,
        extraNames: chosenExtras.map((e) => e.name),
      },
      quantity,
    );
    onAdded();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        className="menu-sheet relative flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[var(--r-xl)] bg-[var(--bg)] sm:rounded-[var(--r-xl)]"
      >
        <div className="overflow-y-auto">
          {/* Fotoğrafı OLMAYAN üründe 16/10'luk placeholder ekranın yarısını
              boş bir harfle dolduruyordu. Görsel yoksa hiç çizilmez; kapatma
              düğmesi o durumda kendi satırında durur. */}
          <div className="relative">
            {product.imageUrl ? (
              <ProductImage
                src={product.imageUrl}
                name={product.name}
                boxClassName="aspect-[16/10] w-full rounded-none"
                sizes="(max-width: 640px) 100vw, 448px"
              />
            ) : (
              <div aria-hidden="true" className="h-12" />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-[var(--bg)]/85 text-lg leading-none text-[var(--fg)] backdrop-blur"
            >
              ×
            </button>
          </div>

          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-1">
              <h2
                className="font-[family-name:var(--t-display)] text-[1.35rem] leading-tight"
                style={{ fontWeight: "var(--t-display-w)", letterSpacing: "var(--t-display-tr)" }}
              >
                {product.name}
              </h2>
              <p className="text-[14px] leading-relaxed text-[var(--fg-muted)]">
                {product.description ?? t("noDescription")}
              </p>
            </div>

            {product.variants.length > 0 && (
              <fieldset className="flex flex-col gap-1">
                <legend className="pb-1 text-[11px] font-semibold tracking-wider text-[var(--fg-faint)] uppercase">
                  {t("variants")}
                </legend>
                {product.variants.map((v) => (
                  <label
                    key={v.id}
                    className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--line)] text-[15px] last:border-b-0"
                  >
                    <span className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        className="size-4 accent-[var(--accent)]"
                        name={`sheet-variant-${product.id}`}
                        checked={variantId === v.id}
                        disabled={!v.isOrderable}
                        onChange={() => setVariantId(v.id)}
                      />
                      {v.name}
                    </span>
                    <span className="tabular-nums text-[var(--fg-muted)]">
                      {v.isOrderable ? formatPrice(v.priceMinor, currency) : t("soldOut")}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {product.extras.length > 0 && (
              <fieldset className="flex flex-col gap-1">
                <legend className="pb-1 text-[11px] font-semibold tracking-wider text-[var(--fg-faint)] uppercase">
                  {t("extras")}
                </legend>
                {product.extras.map((e) => (
                  <label
                    key={e.id}
                    className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--line)] text-[15px] last:border-b-0"
                  >
                    <span className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--accent)]"
                        checked={extraIds.includes(e.id)}
                        disabled={!e.isOrderable}
                        onChange={() =>
                          setExtraIds((prev) =>
                            prev.includes(e.id) ? prev.filter((id) => id !== e.id) : [...prev, e.id],
                          )
                        }
                      />
                      + {e.name}
                    </span>
                    <span className="tabular-nums text-[var(--fg-muted)]">
                      {e.isOrderable ? formatPrice(e.priceMinor, currency) : t("soldOut")}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--line)] bg-[var(--bg)] p-3">
          <Stepper
            quantity={quantity}
            onDecrease={() => setQuantity((q) => Math.max(1, q - 1))}
            onIncrease={() => setQuantity((q) => q + 1)}
            decreaseLabel={t("decrease")}
            increaseLabel={t("increase")}
          />
          <button
            type="button"
            disabled={!canAdd}
            onClick={commit}
            className="min-h-12 flex-1 rounded-full bg-[var(--accent)] text-[15px] font-semibold text-[var(--accent-fg)] disabled:opacity-50"
          >
            {canAdd
              ? t("addWithTotal", { total: formatPrice(unitPriceMinor * quantity, currency) })
              : t("soldOut")}
          </button>
        </div>
      </div>
    </div>
  );
}
