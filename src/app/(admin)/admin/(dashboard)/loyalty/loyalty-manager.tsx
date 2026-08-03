"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AdminLoyaltyCustomer, AdminLoyaltyProgram } from "@/lib/data/loyalty";
import { LOYALTY_MODES, loyaltyProgramFormSchema, type LoyaltyActionResult, type LoyaltyMode, type LoyaltyProgramFormInput } from "@/lib/loyalty/schemas";

type Actions = {
  updateLoyaltyProgram: (input: unknown) => Promise<LoyaltyActionResult>;
};

function formatMinor(minor: number): string {
  return (minor / 100).toFixed(2).replace(".", ",");
}

function ProgramCard({ program, updateLoyaltyProgram }: { program: AdminLoyaltyProgram; updateLoyaltyProgram: Actions["updateLoyaltyProgram"] }) {
  const t = useTranslations("admin.loyalty.program");
  const tErrors = useTranslations("admin.loyalty.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit } = useForm({
    resolver: standardSchemaResolver(loyaltyProgramFormSchema),
    defaultValues: {
      mode: program?.mode ?? ("stamp" as LoyaltyMode),
      isActive: program?.isActive ?? true,
      threshold: program?.mode === "stamp" ? program.config.threshold : undefined,
      rewardValue: program?.mode === "stamp" ? formatMinor(program.config.rewardValueMinor) : undefined,
      earnRatePer100Minor: program?.mode === "points" ? program.config.earnRatePer100Minor : undefined,
      redeemRateValue: program?.mode === "points" ? formatMinor(program.config.redeemRateMinorPerPoint) : undefined,
    },
  });
  // watch() React Compiler'ı devre dışı bırakıyor (bkz. campaigns-manager.tsx
  // ile aynı çözüm) — Controller'ın onChange'i hem react-hook-form state'ini
  // hem bu yerel state'i günceller.
  const [mode, setMode] = useState<LoyaltyMode>(program?.mode ?? "stamp");

  async function onSubmit(values: LoyaltyProgramFormInput) {
    setError(null);
    const result = await updateLoyaltyProgram(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="loyalty-mode">{t("modeLabel")}</Label>
              <Controller
                control={control}
                name="mode"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value) setMode(value as LoyaltyMode);
                    }}
                  >
                    <SelectTrigger id="loyalty-mode" className="w-40" aria-label={t("modeLabel")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOYALTY_MODES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {t(`mode.${m}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => <Switch id="loyalty-active" checked={field.value} onCheckedChange={field.onChange} />}
              />
              <Label htmlFor="loyalty-active">{t("active")}</Label>
            </div>
          </div>

          {mode === "stamp" && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="loyalty-threshold">{t("threshold")}</Label>
                <Input id="loyalty-threshold" type="number" min={1} className="w-24" {...register("threshold")} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="loyalty-reward-value">{t("rewardValue")}</Label>
                <Input id="loyalty-reward-value" className="w-28" {...register("rewardValue")} />
              </div>
            </div>
          )}

          {mode === "points" && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="loyalty-earn-rate">{t("earnRate")}</Label>
                <Input id="loyalty-earn-rate" type="number" min={1} className="w-24" {...register("earnRatePer100Minor")} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="loyalty-redeem-rate">{t("redeemRate")}</Label>
                <Input id="loyalty-redeem-rate" className="w-28" {...register("redeemRateValue")} />
              </div>
            </div>
          )}

          <Button type="submit" size="sm" className="w-fit">
            {t("save")}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

function CustomersCard({ customers }: { customers: AdminLoyaltyCustomer[] }) {
  const t = useTranslations("admin.loyalty.customers");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {customers.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        {customers.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
            <span>{c.maskedPhone}</span>
            <span className="font-medium">{c.balance}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function LoyaltyManager({
  program,
  customers,
  updateLoyaltyProgram,
}: {
  program: AdminLoyaltyProgram;
  customers: AdminLoyaltyCustomer[];
  updateLoyaltyProgram: Actions["updateLoyaltyProgram"];
}) {
  const t = useTranslations("admin.loyalty");

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={t("pageTitle")} />
      <ProgramCard program={program} updateLoyaltyProgram={updateLoyaltyProgram} />
      <CustomersCard customers={customers} />
    </div>
  );
}
