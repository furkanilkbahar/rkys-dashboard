"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminGiftCard } from "@/lib/data/giftCards";
import { issueGiftCardFormSchema, type GiftCardActionResult, type IssueGiftCardFormInput } from "@/lib/giftCards/schemas";
import { formatPrice } from "@/lib/utils/currency";

export function GiftCardsManager({
  giftCards,
  currency,
  issueGiftCard,
}: {
  giftCards: AdminGiftCard[];
  currency: string;
  issueGiftCard: (input: unknown) => Promise<GiftCardActionResult>;
}) {
  const t = useTranslations("admin.giftCards");
  const tErrors = useTranslations("admin.giftCards.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm({
    resolver: standardSchemaResolver(issueGiftCardFormSchema),
    defaultValues: { code: "", initialBalance: "" },
  });

  async function onSubmit(values: IssueGiftCardFormInput) {
    setError(null);
    const result = await issueGiftCard(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    reset({ code: "", initialBalance: "" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{t("pageTitle")}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {giftCards.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
          {giftCards.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <span>{g.code}</span>
              <span className="font-medium">{formatPrice(g.balanceMinor, currency)}</span>
            </div>
          ))}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="gift-card-code">{t("code")}</Label>
              <Input id="gift-card-code" className="w-32 uppercase" {...register("code")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="gift-card-balance">{t("initialBalance")}</Label>
              <Input id="gift-card-balance" className="w-28" {...register("initialBalance")} />
            </div>
            <Button type="submit" size="sm">
              {t("issue")}
            </Button>
          </form>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
