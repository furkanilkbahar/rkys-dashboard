"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DataTable } from "@/components/admin/data-table";
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
      <AdminPageHeader title={t("pageTitle")} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            rows={giftCards}
            rowKey={(card) => card.id}
            empty={t("empty")}
            searchable
            initialSort={{ key: "code" }}
            columns={[
              {
                key: "code",
                header: t("code"),
                primary: true,
                value: (card) => card.code,
                cell: (card) => <span className="font-mono">{card.code}</span>,
              },
              {
                key: "balance",
                header: t("balance"),
                align: "end",
                // Sıralama kuruş cinsinden tam sayı üzerinden — biçimlenmiş
                // "₺1.200,00" metnini sıralamak ₺90'ı ₺1.200'ün üstüne çıkarır.
                value: (card) => card.balanceMinor,
                cell: (card) => (
                  <span className="font-medium tabular-nums">{formatPrice(card.balanceMinor, currency)}</span>
                ),
              },
            ]}
          />

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
