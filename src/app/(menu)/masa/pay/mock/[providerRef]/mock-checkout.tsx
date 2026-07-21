"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils/currency";

import { confirmMockPayment } from "./actions";

export function MockCheckout({
  providerRef,
  amountMinor,
  currency,
  returnUrl,
}: {
  providerRef: string;
  amountMinor: number;
  currency: string;
  returnUrl: string;
}) {
  const t = useTranslations("menu.mockPayment");
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "processing" | "failed">("idle");

  async function handleConfirm() {
    setStatus("processing");
    const result = await confirmMockPayment(providerRef);
    if (!result.ok) {
      setStatus("failed");
      return;
    }
    router.push(returnUrl);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
          <p className="text-2xl font-semibold">{formatPrice(amountMinor, currency)}</p>
          {status === "failed" && <p className="text-sm text-destructive">{t("failed")}</p>}
          <Button type="button" disabled={status === "processing"} onClick={handleConfirm}>
            {status === "processing" ? t("processing") : t("confirm")}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
