"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminTipPreset } from "@/lib/data/adminSettings";
import type { RecentPayment, SessionBalance } from "@/lib/data/cashier";
import type { ReasonCodeOption } from "@/lib/data/reasonCodes";
import type { SessionOrder } from "@/lib/data/sessionOrders";
import type { RecordCompResult, RefundPaymentResult } from "@/lib/cashier/comp-refund-schemas";
import type { RecordPaymentResult } from "@/lib/cashier/payment-schemas";
import { formatPrice } from "@/lib/utils/currency";

type Share = {
  index: number;
  amountMinor: number;
  tipAmountMinor: number;
  paid: boolean;
};

function splitEqually(totalMinor: number, count: number): number[] {
  const base = Math.floor(totalMinor / count);
  const remainder = totalMinor - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

function CompForm({
  order,
  currency,
  compReasons,
  recordComp,
}: {
  order: SessionOrder;
  currency: string;
  compReasons: ReasonCodeOption[];
  recordComp: (input: unknown) => Promise<RecordCompResult>;
}) {
  const t = useTranslations("cashier.pay.comp");
  const tErrors = useTranslations("cashier.pay.errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reasonCodeId, setReasonCodeId] = useState(compReasons[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setError(null);
    const amountMinor = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!amountMinor || amountMinor <= 0 || !reasonCodeId) {
      setError(tErrors("invalid_input"));
      return;
    }
    const result = await recordComp({ orderId: order.id, amountMinor, reasonCodeId });
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return <Badge variant="secondary">{t("applied")}</Badge>;
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        {t("addButton")}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`comp-amount-${order.id}`}>{t("amount")}</Label>
        <Input
          id={`comp-amount-${order.id}`}
          className="w-24"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={formatPrice(order.subtotalMinor, currency)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`comp-reason-${order.id}`}>{t("reason")}</Label>
        <Select value={reasonCodeId} onValueChange={(v) => v && setReasonCodeId(v)}>
          <SelectTrigger id={`comp-reason-${order.id}`} className="w-36" aria-label={t("reason")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {compReasons.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="button" size="sm" onClick={submit}>
        {t("confirm")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function RecentPaymentRow({
  payment,
  currency,
  refundReasons,
  refundPayment,
}: {
  payment: RecentPayment;
  currency: string;
  refundReasons: ReasonCodeOption[];
  refundPayment: (input: unknown) => Promise<RefundPaymentResult>;
}) {
  const t = useTranslations("cashier.pay.refund");
  const tErrors = useTranslations("cashier.pay.errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reasonCodeId, setReasonCodeId] = useState(refundReasons[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!reasonCodeId) {
      setError(tErrors("invalid_input"));
      return;
    }
    const result = await refundPayment({ paymentId: payment.id, reasonCodeId });
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span>
          {payment.tableLabel} — {formatPrice(payment.amountMinor + payment.tipAmountMinor, currency)}
        </span>
        {payment.status === "refunded" ? (
          <Badge variant="secondary">{t("refunded")}</Badge>
        ) : open ? null : (
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            {t("button")}
          </Button>
        )}
      </div>
      {open && payment.status === "completed" && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`refund-reason-${payment.id}`}>{t("reason")}</Label>
            <Select value={reasonCodeId} onValueChange={(v) => v && setReasonCodeId(v)}>
              <SelectTrigger id={`refund-reason-${payment.id}`} className="w-36" aria-label={t("reason")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {refundReasons.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" size="sm" onClick={submit}>
            {t("confirm")}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function PayScreen({
  currency,
  sessions,
  ordersBySession,
  tipPresets,
  compReasons,
  refundReasons,
  recentPayments,
  recordPayment,
  recordComp,
  refundPayment,
}: {
  currency: string;
  sessions: SessionBalance[];
  ordersBySession: Record<string, SessionOrder[]>;
  tipPresets: AdminTipPreset[];
  compReasons: ReasonCodeOption[];
  refundReasons: ReasonCodeOption[];
  recentPayments: RecentPayment[];
  recordPayment: (input: unknown) => Promise<RecordPaymentResult>;
  recordComp: (input: unknown) => Promise<RecordCompResult>;
  refundPayment: (input: unknown) => Promise<RefundPaymentResult>;
}) {
  const t = useTranslations("cashier.pay");
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>("");
  const [splitCount, setSplitCount] = useState(1);
  const [tipPercentage, setTipPercentage] = useState(0);
  const [method, setMethod] = useState<"cash" | "card_manual">("cash");
  const [splitGroup, setSplitGroup] = useState<string | null>(null);
  const [shares, setShares] = useState<Share[]>([]);
  const [error, setError] = useState<string | null>(null);

  const session = sessions.find((s) => s.tableSessionId === sessionId) ?? null;
  const tipTotalMinor = session ? Math.round((session.balanceMinor * tipPercentage) / 100) : 0;

  const computedShares = useMemo(() => {
    if (!session) return [];
    const amountShares = splitEqually(session.balanceMinor, splitCount);
    const tipShares = splitEqually(tipTotalMinor, splitCount);
    return amountShares.map((amountMinor, i) => ({ amountMinor, tipAmountMinor: tipShares[i] }));
  }, [session, splitCount, tipTotalMinor]);

  function selectSession(id: string) {
    setSessionId(id);
    setSplitCount(1);
    setTipPercentage(0);
    setSplitGroup(crypto.randomUUID());
    setShares([]);
    setError(null);
  }

  function startPaying() {
    setShares(
      computedShares.map((s, i) => ({ index: i, amountMinor: s.amountMinor, tipAmountMinor: s.tipAmountMinor, paid: false })),
    );
  }

  async function payShare(share: Share) {
    if (!session) return;
    setError(null);
    const result = await recordPayment({
      tableSessionId: session.tableSessionId,
      method,
      amountMinor: share.amountMinor,
      tipAmountMinor: share.tipAmountMinor,
      splitGroup: splitCount > 1 ? splitGroup : null,
    });

    if (!result.ok) {
      setError(t(`errors.${result.error}`));
      return;
    }

    setShares((prev) => prev.map((s) => (s.index === share.index ? { ...s, paid: true } : s)));
    router.refresh();
  }

  const allPaid = shares.length > 0 && shares.every((s) => s.paid);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("selectSession")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {sessions.length === 0 && <p className="text-sm text-muted-foreground">{t("noBalances")}</p>}
          {sessions.map((s) => (
            <button
              key={s.tableSessionId}
              type="button"
              onClick={() => selectSession(s.tableSessionId)}
              className={`flex items-center justify-between rounded-md border p-2 text-sm ${
                sessionId === s.tableSessionId ? "border-primary" : "border-border"
              }`}
            >
              <span className="flex items-center gap-2">
                {s.tableLabel}
                {s.checkRequested && <Badge variant="secondary">{t("checkRequested")}</Badge>}
              </span>
              <span>{formatPrice(s.balanceMinor, currency)}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      {session && shares.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("checkoutTitle", { table: session.tableLabel })}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm">
              {t("balance")}: {formatPrice(session.balanceMinor, currency)}
            </p>

            {compReasons.length > 0 && (ordersBySession[session.tableSessionId]?.length ?? 0) > 0 && (
              <div className="flex flex-col gap-2">
                <Label>{t("comp.title")}</Label>
                {ordersBySession[session.tableSessionId]
                  .filter((o) => o.status !== "cancelled")
                  .map((order) => (
                    <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
                      <span>
                        {order.deviceLabel} — {formatPrice(order.subtotalMinor, currency)}
                      </span>
                      <CompForm order={order} currency={currency} compReasons={compReasons} recordComp={recordComp} />
                    </div>
                  ))}
              </div>
            )}

            {tipPresets.length > 0 && (
              <div className="flex flex-col gap-1">
                <Label>{t("tip")}</Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={tipPercentage === 0 ? "default" : "outline"} onClick={() => setTipPercentage(0)}>
                    {t("noTip")}
                  </Button>
                  {tipPresets.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      size="sm"
                      variant={tipPercentage === preset.percentage ? "default" : "outline"}
                      onClick={() => setTipPercentage(preset.percentage)}
                    >
                      {preset.label} (%{preset.percentage})
                    </Button>
                  ))}
                </div>
                {tipTotalMinor > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("tipAmount")}: {formatPrice(tipTotalMinor, currency)}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <Label htmlFor="split-count">{t("splitCount")}</Label>
              <Input
                id="split-count"
                type="number"
                min={1}
                max={10}
                className="w-24"
                value={splitCount}
                onChange={(e) => setSplitCount(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label>{t("method")}</Label>
              <Select value={method} onValueChange={(v) => v && setMethod(v as "cash" | "card_manual")}>
                <SelectTrigger className="w-40" aria-label={t("method")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("cash")}</SelectItem>
                  <SelectItem value="card_manual">{t("cardManual")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="button" onClick={startPaying}>
              {t("startPaying")}
            </Button>
          </CardContent>
        </Card>
      )}

      {session && shares.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("sharesTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {shares.map((share) => (
              <div key={share.index} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
                <span>
                  {t("share", { index: share.index + 1 })}: {formatPrice(share.amountMinor + share.tipAmountMinor, currency)}
                </span>
                {share.paid ? (
                  <Badge variant="secondary">{t("paid")}</Badge>
                ) : (
                  <Button type="button" size="sm" onClick={() => payShare(share)}>
                    {t("pay")}
                  </Button>
                )}
              </div>
            ))}
            {error && <p className="text-xs text-destructive">{error}</p>}
            {allPaid && <p className="text-sm text-primary">{t("allPaid")}</p>}
          </CardContent>
        </Card>
      )}

      {refundReasons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("refund.recentTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recentPayments.length === 0 && <p className="text-sm text-muted-foreground">{t("refund.empty")}</p>}
            {recentPayments.map((payment) => (
              <RecentPaymentRow key={payment.id} payment={payment} currency={currency} refundReasons={refundReasons} refundPayment={refundPayment} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
