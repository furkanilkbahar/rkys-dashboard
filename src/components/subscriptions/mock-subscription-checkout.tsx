"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmMockSubscriptionPayment } from "@/lib/subscriptions/mockCheckoutAction";

export function MockSubscriptionCheckout({
  providerRef,
  planName,
  returnUrl,
}: {
  providerRef: string;
  planName: string;
  returnUrl: string;
}) {
  const t = useTranslations("admin.billing.mock");
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "processing" | "failed">("idle");

  async function handleConfirm() {
    setStatus("processing");
    const result = await confirmMockSubscriptionPayment(providerRef);
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
          {planName && <p className="text-lg font-semibold">{planName}</p>}
          {status === "failed" && <p className="text-sm text-destructive">{t("failed")}</p>}
          <Button type="button" disabled={status === "processing"} onClick={handleConfirm}>
            {status === "processing" ? t("processing") : t("confirm")}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
