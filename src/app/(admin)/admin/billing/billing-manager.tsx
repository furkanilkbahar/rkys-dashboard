"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Plan } from "@/lib/data/plans";
import type { AdminSubscription } from "@/lib/data/subscription";

import type { BillingActionResult } from "./actions";

export function BillingManager({
  isOwner,
  subscription,
  trialDaysLeft,
  plans,
  startSubscriptionCheckout,
  cancelSubscription,
}: {
  isOwner: boolean;
  subscription: AdminSubscription | null;
  trialDaysLeft: number | null;
  plans: Plan[];
  startSubscriptionCheckout: (planId: string) => Promise<BillingActionResult>;
  cancelSubscription: () => Promise<BillingActionResult>;
}) {
  const t = useTranslations("admin.billing");
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? "");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = subscription?.status ?? "trialing";

  async function handleCheckout() {
    setError(null);
    setIsPending(true);
    const result = await startSubscriptionCheckout(selectedPlanId);
    if (!result.ok || !result.checkoutUrl) {
      setError(t("error"));
      setIsPending(false);
      return;
    }
    window.location.assign(result.checkoutUrl);
  }

  async function handleCancel() {
    setIsPending(true);
    await cancelSubscription();
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <AdminPageHeader title={t("title")} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("statusTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Badge variant={status === "active" ? "secondary" : "destructive"}>{t(`status.${status}`)}</Badge>
            {status === "trialing" && trialDaysLeft !== null && (
              <span className="text-sm text-muted-foreground">{t("trialDaysLeft", { count: trialDaysLeft })}</span>
            )}
          </div>

          {isOwner && status !== "active" && (
            <div className="flex flex-wrap items-end gap-2">
              <Select value={selectedPlanId} onValueChange={(value) => setSelectedPlanId(value ?? "")}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t("selectPlan")} />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleCheckout} disabled={isPending || !selectedPlanId}>
                {t("payNow")}
              </Button>
            </div>
          )}

          {isOwner && status === "active" && (
            <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
              {t("cancel")}
            </Button>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
