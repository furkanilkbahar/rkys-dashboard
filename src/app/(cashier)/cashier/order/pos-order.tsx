"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CashierTable } from "@/lib/data/cashier";
import type { MenuCategory, MenuProduct } from "@/lib/data/menu";
import type { SubmitStaffOrderResult } from "@/lib/pos/schemas";
import { formatPrice } from "@/lib/utils/currency";

type CartLine = {
  key: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  unitPriceMinor: number;
  quantity: number;
  extraIds: string[];
  extraNames: string[];
};

function ProductRow({
  product,
  currency,
  onAdd,
}: {
  product: MenuProduct;
  currency: string;
  onAdd: (line: CartLine) => void;
}) {
  const t = useTranslations("cashier.order");
  const [variantId, setVariantId] = useState<string | null>(
    product.variants.find((v) => v.isOrderable)?.id ?? product.variants[0]?.id ?? null,
  );
  const [extraIds, setExtraIds] = useState<string[]>([]);

  const selectedVariant = product.variants.find((v) => v.id === variantId) ?? null;
  const canAdd = product.variants.length > 0 ? (selectedVariant?.isOrderable ?? false) : product.isOrderable;
  const unitPrice = selectedVariant ? selectedVariant.priceMinor : product.priceMinor;

  function toggleExtra(id: string) {
    setExtraIds((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  function handleAdd() {
    if (!canAdd) return;
    const chosenExtras = product.extras.filter((e) => extraIds.includes(e.id));
    onAdd({
      key: `${product.id}:${variantId ?? ""}:${extraIds.sort().join(",")}`,
      productId: product.id,
      variantId,
      productName: product.name,
      variantName: selectedVariant?.name ?? null,
      unitPriceMinor: unitPrice + chosenExtras.reduce((sum, e) => sum + e.priceMinor, 0),
      quantity: 1,
      extraIds,
      extraNames: chosenExtras.map((e) => e.name),
    });
    setExtraIds([]);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{product.name}</span>
        <div className="flex items-center gap-2">
          {!canAdd && <Badge variant="destructive">{t("soldOut")}</Badge>}
          <span className="text-sm text-muted-foreground">{formatPrice(unitPrice, currency)}</span>
        </div>
      </div>

      {product.variants.length > 0 && (
        <Select value={variantId ?? ""} onValueChange={setVariantId}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {product.variants.map((v) => (
              <SelectItem key={v.id} value={v.id} disabled={!v.isOrderable}>
                {v.name} — {formatPrice(v.priceMinor, currency)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {product.extras.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {product.extras.map((extra) => (
            <label key={extra.id} className="flex items-center gap-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={extraIds.includes(extra.id)}
                disabled={!extra.isOrderable}
                onChange={() => toggleExtra(extra.id)}
              />
              + {extra.name} ({formatPrice(extra.priceMinor, currency)})
            </label>
          ))}
        </div>
      )}

      <Button type="button" size="sm" disabled={!canAdd} onClick={handleAdd} className="w-fit">
        {t("addToOrder")}
      </Button>
    </div>
  );
}

export function PosOrder({
  currency,
  tables,
  categories,
  submitStaffOrder,
}: {
  currency: string;
  tables: CashierTable[];
  categories: MenuCategory[];
  submitStaffOrder: (input: unknown) => Promise<SubmitStaffOrderResult>;
}) {
  const t = useTranslations("cashier.order");
  const [tableId, setTableId] = useState<string>("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  const subtotalMinor = cart.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);

  function addLine(line: CartLine) {
    setStatus("idle");
    setCart((prev) => {
      const existing = prev.find((l) => l.key === line.key);
      if (existing) {
        return prev.map((l) => (l.key === line.key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, line];
    });
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  async function handleSubmit() {
    if (!tableId || cart.length === 0) return;
    setStatus("submitting");
    setError(null);

    const result = await submitStaffOrder({
      tableId,
      items: cart.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: l.quantity,
        extraIds: l.extraIds,
      })),
    });

    if (!result.ok) {
      setStatus("idle");
      setError(t(`errors.${result.error}`));
      return;
    }

    setStatus("success");
    setCart([]);
    setTimeout(() => setStatus("idle"), 2500);
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("selectTable")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={tableId} onValueChange={(value) => setTableId(value ?? "")}>
              <SelectTrigger className="w-full" aria-label={t("selectTable")}>
                <SelectValue placeholder={t("selectTable")} />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.isCounter ? `${table.label} (${t("counter")})` : table.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {categories.map((category) => (
          <Card key={category.id}>
            <CardHeader>
              <CardTitle className="text-base">{category.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {category.products.map((product) => (
                <ProductRow key={product.id} product={product} currency={currency} onAdd={addLine} />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle className="text-base">{t("cartTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {cart.length === 0 && <p className="text-sm text-muted-foreground">{t("emptyCart")}</p>}
          {cart.map((line) => (
            <div key={line.key} className="flex items-start justify-between gap-2 text-sm">
              <div>
                <p>
                  {line.quantity}× {line.productName}
                  {line.variantName ? ` (${line.variantName})` : ""}
                </p>
                {line.extraNames.length > 0 && (
                  <p className="text-xs text-muted-foreground">+ {line.extraNames.join(", ")}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span>{formatPrice(line.unitPriceMinor * line.quantity, currency)}</span>
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  aria-label={t("removeLine")}
                  className="text-xs text-destructive"
                >
                  ×
                </button>
              </div>
            </div>
          ))}

          {cart.length > 0 && (
            <p className="border-t border-border pt-2 text-sm font-semibold">
              {t("subtotal")}: {formatPrice(subtotalMinor, currency)}
            </p>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
          {status === "success" && <p className="text-xs text-primary">{t("submitted")}</p>}

          <Button
            type="button"
            disabled={!tableId || cart.length === 0 || status === "submitting"}
            onClick={handleSubmit}
          >
            {status === "submitting" ? t("submitting") : t("submit")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
