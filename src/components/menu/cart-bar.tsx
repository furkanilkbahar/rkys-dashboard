"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { SubmitOrderInput, SubmitOrderResult } from "@/lib/orders/schemas";
import { useCartStore } from "@/lib/store/cart";

function formatPrice(priceMinor: number): string {
  return (priceMinor / 100).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
}

export function CartBar({ onSubmit }: { onSubmit: (input: SubmitOrderInput) => Promise<SubmitOrderResult> }) {
  const t = useTranslations("menu.cart");
  const lines = useCartStore((state) => state.lines);
  const clear = useCartStore((state) => state.clear);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotalMinor = lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);

  if (itemCount === 0 && status !== "success") {
    return null;
  }

  async function handleSubmit() {
    setStatus("submitting");
    setErrorKey(null);

    const result = await onSubmit({
      idempotencyKey: crypto.randomUUID(),
      items: lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
        extraIds: line.extraIds,
      })),
    });

    if (result.ok) {
      clear();
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("error");
      setErrorKey(result.error);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background p-4 shadow-lg">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {status === "success" && <p className="text-sm text-primary">{t("success")}</p>}
        {status === "error" && errorKey && <p className="text-sm text-destructive">{t(errorKey)}</p>}
        {itemCount > 0 && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">{t("itemCount", { count: itemCount })}</p>
            <p className="text-sm font-semibold">{formatPrice(subtotalMinor)}</p>
            <Button type="button" disabled={status === "submitting"} onClick={handleSubmit}>
              {status === "submitting" ? t("submitting") : t("submit")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
