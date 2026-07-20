"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MenuProduct } from "@/lib/data/menu";
import { lineKey, useCartStore } from "@/lib/store/cart";

function formatPrice(priceMinor: number): string {
  return (priceMinor / 100).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
}

export function ProductCard({ product }: { product: MenuProduct }) {
  const t = useTranslations("menu.product");
  const addLine = useCartStore((state) => state.addLine);
  const [expanded, setExpanded] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    product.variants.find((v) => v.isOrderable)?.id ?? product.variants[0]?.id ?? null,
  );
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);
  const [justAdded, setJustAdded] = useState(false);

  const hasDetails = product.variants.length > 0 || product.extras.length > 0;
  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId) ?? null;
  const displayPrice =
    product.variants.length > 0 ? Math.min(...product.variants.map((v) => v.priceMinor)) : product.priceMinor;

  const canAdd = useMemo(() => {
    if (product.variants.length > 0) {
      return selectedVariant !== null && selectedVariant.isOrderable;
    }
    return product.isOrderable;
  }, [product, selectedVariant]);

  function toggleExtra(extraId: string) {
    setSelectedExtraIds((prev) =>
      prev.includes(extraId) ? prev.filter((id) => id !== extraId) : [...prev, extraId],
    );
  }

  function handleAdd() {
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
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <Card>
        {product.imageUrl && (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-[calc(var(--radius)-1px)]">
            <Image src={product.imageUrl} alt="" fill unoptimized className="object-cover" />
          </div>
        )}
        <CardHeader
          className={hasDetails ? "cursor-pointer" : undefined}
          onClick={hasDetails ? () => setExpanded((v) => !v) : undefined}
        >
          <CardTitle className="flex items-center justify-between gap-2">
            <span>{product.name}</span>
            {!product.isOrderable && <Badge variant="destructive">{t("soldOut")}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">
            {product.variants.length > 0
              ? t("priceFrom", { price: formatPrice(displayPrice) })
              : formatPrice(displayPrice)}
          </p>

          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-3 text-sm"
            >
              {product.variants.length > 0 && (
                <fieldset className="flex flex-col gap-1">
                  {product.variants.map((variant) => (
                    <label key={variant.id} className="flex items-center justify-between gap-2 text-muted-foreground">
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
                      <span className="flex items-center gap-2">
                        {!variant.isOrderable && <Badge variant="destructive">{t("soldOut")}</Badge>}
                        {formatPrice(variant.priceMinor)}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              {product.extras.length > 0 && (
                <fieldset className="flex flex-col gap-1">
                  {product.extras.map((extra) => (
                    <label key={extra.id} className="flex items-center justify-between gap-2 text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedExtraIds.includes(extra.id)}
                          disabled={!extra.isOrderable}
                          onChange={() => toggleExtra(extra.id)}
                        />
                        + {extra.name}
                      </span>
                      <span className="flex items-center gap-2">
                        {!extra.isOrderable && <Badge variant="destructive">{t("soldOut")}</Badge>}
                        {formatPrice(extra.priceMinor)}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
            </motion.div>
          )}

          <Button type="button" size="sm" disabled={!canAdd} onClick={handleAdd}>
            {justAdded ? t("added") : t("addToCart")}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
