"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CashMovement, ClosedCashShift, OpenCashShift } from "@/lib/data/cashier";
import {
  cashMovementFormSchema,
  closeShiftFormSchema,
  openShiftFormSchema,
  type CashierActionResult,
  type OpenShiftResult,
} from "@/lib/cashier/schemas";
import { formatPrice } from "@/lib/utils/currency";

type Actions = {
  openShift: (branchId: string, input: unknown) => Promise<OpenShiftResult>;
  closeShift: (shiftId: string, input: unknown) => Promise<CashierActionResult>;
  recordCashMovement: (shiftId: string, input: unknown) => Promise<CashierActionResult>;
};

function OpenShiftForm({
  branchId,
  currency,
  openShift,
}: {
  branchId: string;
  currency: string;
  openShift: Actions["openShift"];
}) {
  const t = useTranslations("cashier.shift");
  const tErrors = useTranslations("cashier.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit } = useForm({
    resolver: standardSchemaResolver(openShiftFormSchema),
    defaultValues: { openingBalance: "0" },
  });

  async function onSubmit(values: { openingBalance: string }) {
    setError(null);
    const result = await openShift(branchId, values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("openTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="opening-balance">{t("openingBalance", { currency })}</Label>
            <Input id="opening-balance" className="w-32" {...register("openingBalance")} />
          </div>
          <Button type="submit" size="sm">
            {t("openShift")}
          </Button>
          {error && <p className="text-[13px] text-[var(--sem-err-fg)]">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

function CloseShiftForm({
  shiftId,
  closeShift,
}: {
  shiftId: string;
  closeShift: Actions["closeShift"];
}) {
  const t = useTranslations("cashier.shift");
  const tErrors = useTranslations("cashier.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit } = useForm({
    resolver: standardSchemaResolver(closeShiftFormSchema),
    defaultValues: { countedCash: "0" },
  });

  async function onSubmit(values: { countedCash: string }) {
    setError(null);
    const result = await closeShift(shiftId, values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="counted-cash">{t("countedCash")}</Label>
        <Input id="counted-cash" className="w-32" {...register("countedCash")} />
      </div>
      <Button type="submit" size="sm" variant="destructive">
        {t("closeShift")}
      </Button>
      {error && <p className="text-[13px] text-[var(--sem-err-fg)]">{error}</p>}
    </form>
  );
}

function CashMovementForm({
  shiftId,
  recordCashMovement,
}: {
  shiftId: string;
  recordCashMovement: Actions["recordCashMovement"];
}) {
  const t = useTranslations("cashier.shift");
  const tErrors = useTranslations("cashier.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset } = useForm({
    resolver: standardSchemaResolver(cashMovementFormSchema),
    defaultValues: { movementType: "cash_in" as const, amount: "0", note: "" },
  });

  async function onSubmit(values: { movementType: "cash_in" | "cash_out"; amount: string; note: string }) {
    setError(null);
    const result = await recordCashMovement(shiftId, values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    reset({ movementType: "cash_in", amount: "0", note: "" });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2">
      <Controller
        control={control}
        name="movementType"
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash_in">{t("cashIn")}</SelectItem>
              <SelectItem value="cash_out">{t("cashOut")}</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor="movement-amount">{t("amount")}</Label>
        <Input id="movement-amount" className="w-28" {...register("amount")} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="movement-note">{t("note")}</Label>
        <Input id="movement-note" className="w-40" {...register("note")} />
      </div>
      <Button type="submit" size="sm">
        {t("addMovement")}
      </Button>
      {error && <p className="text-[13px] text-[var(--sem-err-fg)]">{error}</p>}
    </form>
  );
}

export function ShiftWidget({
  branchId,
  currency,
  openShiftData,
  lastClosedShift,
  movements,
  actions,
}: {
  branchId: string;
  currency: string;
  openShiftData: OpenCashShift | null;
  lastClosedShift: ClosedCashShift | null;
  movements: CashMovement[];
  actions: Actions;
}) {
  const t = useTranslations("cashier.shift");

  if (!openShiftData) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <OpenShiftForm branchId={branchId} currency={currency} openShift={actions.openShift} />
        {lastClosedShift && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("lastClosedTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              <p>
                {t("expected")}: {formatPrice(lastClosedShift.expectedCashMinor ?? 0, currency)}
              </p>
              <p>
                {t("counted")}: {formatPrice(lastClosedShift.countedCashMinor ?? 0, currency)}
              </p>
              <p>
                {t("variance")}:{" "}
                <span className={(lastClosedShift.varianceMinor ?? 0) < 0 ? "text-destructive" : "text-primary"}>
                  {formatPrice(lastClosedShift.varianceMinor ?? 0, currency)}
                </span>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("openShiftTitle")}</CardTitle>
          <Badge variant="secondary">{t("open")}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {t("openingBalanceLabel")}: {formatPrice(openShiftData.openingBalanceMinor, currency)}
          </p>
          <CashMovementForm shiftId={openShiftData.id} recordCashMovement={actions.recordCashMovement} />
          <CloseShiftForm shiftId={openShiftData.id} closeShift={actions.closeShift} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("movementsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {movements.length === 0 && <p className="text-sm text-muted-foreground">{t("noMovements")}</p>}
          {movements.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm">
              <span>{t(`movementType.${m.movementType}`)}</span>
              <span>{formatPrice(m.amountMinor, currency)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
