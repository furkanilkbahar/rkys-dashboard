"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { updateProductCost } from "@/app/(admin)/admin/(dashboard)/reports/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductWithCost } from "@/lib/data/productCosts";
import { formatPrice } from "@/lib/utils/currency";

export function ProductCostRow({ product, currency }: { product: ProductWithCost; currency: string }) {
  const t = useTranslations("admin.reports.costs");
  const tErrors = useTranslations("admin.reports.errors");
  const router = useRouter();
  const [value, setValue] = useState(product.costMinor !== null ? (product.costMinor / 100).toFixed(2) : "");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const costMinor = Math.round(parseFloat(value.replace(",", ".")) * 100);
    if (isNaN(costMinor) || costMinor < 0) {
      setError(tErrors("invalid_input"));
      return;
    }
    const result = await updateProductCost({ productId: product.productId, costMinor });
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2 text-sm">
      <span className="min-w-40 flex-1">{product.name}</span>
      <span className="text-muted-foreground">{formatPrice(product.basePriceMinor, currency)}</span>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`cost-${product.productId}`}>{t("cost")}</Label>
        <Input
          id={`cost-${product.productId}`}
          className="w-24"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button type="button" size="sm" onClick={save}>
        {t("save")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
