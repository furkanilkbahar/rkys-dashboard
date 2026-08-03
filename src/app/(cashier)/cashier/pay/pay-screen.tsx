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
      {error && <p className="text-[13px] text-[var(--sem-err)]">{error}</p>}
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
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [manualAmount, setManualAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const remainingMinor = payment.amountMinor + payment.tipAmountMinor - payment.refundedMinor;
  const isRefundable = payment.status === "completed" || payment.status === "partially_refunded";

  const selectedItemsAmountMinor = payment.refundableItems
    .filter((item) => selectedItemIds.has(item.orderItemId))
    .reduce((sum, item) => sum + item.unitPriceMinor * item.remainingQuantity, 0);

  function toggleItemSelection(itemId: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function submit() {
    setError(null);
    if (!reasonCodeId) {
      setError(tErrors("invalid_input"));
      return;
    }

    if (selectedItemIds.size > 0) {
      const itemAllocations = payment.refundableItems
        .filter((item) => selectedItemIds.has(item.orderItemId))
        .map((item) => ({ orderItemId: item.orderItemId, quantity: item.remainingQuantity, amountMinor: item.unitPriceMinor * item.remainingQuantity }));
      const result = await refundPayment({ paymentId: payment.id, amountMinor: selectedItemsAmountMinor, reasonCodeId, itemAllocations });
      if (!result.ok) {
        setError(tErrors(result.error));
        return;
      }
      setSelectedItemIds(new Set());
      router.refresh();
      return;
    }

    const amountMinor = Math.round(parseFloat(manualAmount.replace(",", ".")) * 100);
    if (!amountMinor || amountMinor <= 0) {
      setError(tErrors("invalid_input"));
      return;
    }
    const result = await refundPayment({ paymentId: payment.id, amountMinor, reasonCodeId });
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
        <span className="flex items-center gap-2">
          {payment.status === "refunded" && <Badge variant="secondary">{t("refunded")}</Badge>}
          {payment.status === "partially_refunded" && <Badge variant="secondary">{t("partiallyRefunded")}</Badge>}
          {isRefundable && !open && (
            <Button type="button" size="sm" variant="outline" onClick={() => { setOpen(true); setManualAmount((remainingMinor / 100).toString()); }}>
              {t("button")}
            </Button>
          )}
        </span>
      </div>
      {open && isRefundable && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-[var(--surface-fg-muted)]">
            {t("remaining")}: {formatPrice(remainingMinor, currency)}
          </p>

          {payment.refundableItems.length > 0 && (
            <div className="flex flex-col gap-1">
              <Label>{t("itemsTitle")}</Label>
              {payment.refundableItems.map((item) => (
                <label key={item.orderItemId} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={item.name}
                    checked={selectedItemIds.has(item.orderItemId)}
                    onChange={() => toggleItemSelection(item.orderItemId)}
                    className="size-4"
                  />
                  {item.name}
                  {item.variantName ? ` (${item.variantName})` : ""} × {item.remainingQuantity} —{" "}
                  {formatPrice(item.unitPriceMinor * item.remainingQuantity, currency)}
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`refund-amount-${payment.id}`}>{t("amount")}</Label>
              <Input
                id={`refund-amount-${payment.id}`}
                className="w-24"
                inputMode="decimal"
                value={manualAmount}
                disabled={selectedItemIds.size > 0}
                onChange={(e) => setManualAmount(e.target.value)}
              />
            </div>
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
          </div>
          {error && <p className="text-[13px] text-[var(--sem-err)]">{error}</p>}
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
  giftCardsEnabled,
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
  giftCardsEnabled: boolean;
  recordPayment: (input: unknown) => Promise<RecordPaymentResult>;
  recordComp: (input: unknown) => Promise<RecordCompResult>;
  refundPayment: (input: unknown) => Promise<RefundPaymentResult>;
}) {
  const t = useTranslations("cashier.pay");
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<"amount" | "items">("amount");
  const [splitCount, setSplitCount] = useState(1);
  const [tipPercentage, setTipPercentage] = useState(0);
  const [method, setMethod] = useState<"cash" | "card_manual" | "gift_card">("cash");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [splitGroup, setSplitGroup] = useState<string | null>(null);
  const [shares, setShares] = useState<Share[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const session = sessions.find((s) => s.tableSessionId === sessionId) ?? null;
  const tipTotalMinor = session ? Math.round((session.balanceMinor * tipPercentage) / 100) : 0;

  const computedShares = useMemo(() => {
    if (!session) return [];
    const amountShares = splitEqually(session.balanceMinor, splitCount);
    const tipShares = splitEqually(tipTotalMinor, splitCount);
    return amountShares.map((amountMinor, i) => ({ amountMinor, tipAmountMinor: tipShares[i] }));
  }, [session, splitCount, tipTotalMinor]);

  const remainingItems = useMemo(() => {
    if (!session) return [];
    return (ordersBySession[session.tableSessionId] ?? [])
      .filter((o) => o.status !== "cancelled")
      .flatMap((o) => o.items)
      .filter((item) => item.quantity - item.paidQuantity > 0);
  }, [session, ordersBySession]);

  const selectedItemsTotalMinor = useMemo(
    () =>
      remainingItems
        .filter((item) => selectedItemIds.has(item.id))
        .reduce((sum, item) => sum + item.unitPriceMinor * (item.quantity - item.paidQuantity), 0),
    [remainingItems, selectedItemIds],
  );

  function selectSession(id: string) {
    setSessionId(id);
    setPaymentMode("amount");
    setSplitCount(1);
    setTipPercentage(0);
    setSplitGroup(crypto.randomUUID());
    setShares([]);
    setSelectedItemIds(new Set());
    setGiftCardCode("");
    setError(null);
  }

  function toggleItemSelection(itemId: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function payForSelectedItems() {
    if (!session || selectedItemsTotalMinor <= 0) return;
    setError(null);
    const itemAllocations = remainingItems
      .filter((item) => selectedItemIds.has(item.id))
      .map((item) => ({
        orderItemId: item.id,
        quantity: item.quantity - item.paidQuantity,
        amountMinor: item.unitPriceMinor * (item.quantity - item.paidQuantity),
      }));

    const result = await recordPayment({
      tableSessionId: session.tableSessionId,
      method,
      amountMinor: selectedItemsTotalMinor,
      tipAmountMinor: 0,
      splitGroup: null,
      itemAllocations,
      giftCardCode: method === "gift_card" ? giftCardCode.trim().toUpperCase() : null,
    });

    if (!result.ok) {
      setError(t(`errors.${result.error}`));
      return;
    }

    setSelectedItemIds(new Set());
    router.refresh();
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
      giftCardCode: method === "gift_card" ? giftCardCode.trim().toUpperCase() : null,
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
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
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

            <div className="flex flex-col gap-1">
              <Label>{t("paymentMode.label")}</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant={paymentMode === "amount" ? "default" : "outline"} onClick={() => setPaymentMode("amount")}>
                  {t("paymentMode.amount")}
                </Button>
                {remainingItems.length > 0 && (
                  <Button type="button" size="sm" variant={paymentMode === "items" ? "default" : "outline"} onClick={() => setPaymentMode("items")}>
                    {t("paymentMode.items")}
                  </Button>
                )}
              </div>
            </div>

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

            {paymentMode === "amount" && tipPresets.length > 0 && (
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
                  <p className="text-[13px] text-[var(--surface-fg-muted)]">
                    {t("tipAmount")}: {formatPrice(tipTotalMinor, currency)}
                  </p>
                )}
              </div>
            )}

            {paymentMode === "amount" && (
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
            )}

            {paymentMode === "items" && (
              <div className="flex flex-col gap-2">
                <Label>{t("paymentMode.itemsTitle")}</Label>
                {remainingItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        aria-label={item.name}
                        checked={selectedItemIds.has(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                        className="size-4"
                      />
                      {item.name}
                      {item.variantName ? ` (${item.variantName})` : ""} × {item.quantity - item.paidQuantity}
                    </span>
                    <span>{formatPrice(item.unitPriceMinor * (item.quantity - item.paidQuantity), currency)}</span>
                  </label>
                ))}
                <p className="text-sm font-medium">
                  {t("paymentMode.selectedTotal")}: {formatPrice(selectedItemsTotalMinor, currency)}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <Label>{t("method")}</Label>
              <Select value={method} onValueChange={(v) => v && setMethod(v as "cash" | "card_manual" | "gift_card")}>
                <SelectTrigger className="w-40" aria-label={t("method")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("cash")}</SelectItem>
                  <SelectItem value="card_manual">{t("cardManual")}</SelectItem>
                  {giftCardsEnabled && <SelectItem value="gift_card">{t("giftCard")}</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {method === "gift_card" && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="gift-card-code-input">{t("giftCardCode")}</Label>
                <Input
                  id="gift-card-code-input"
                  className="w-40 uppercase"
                  value={giftCardCode}
                  onChange={(e) => setGiftCardCode(e.target.value)}
                />
              </div>
            )}

            {paymentMode === "amount" ? (
              <Button type="button" onClick={startPaying}>
                {t("startPaying")}
              </Button>
            ) : (
              <Button type="button" onClick={payForSelectedItems} disabled={selectedItemsTotalMinor <= 0}>
                {t("paymentMode.pay")}
              </Button>
            )}
            {paymentMode === "items" && error && <p className="text-[13px] text-[var(--sem-err)]">{error}</p>}
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
            {error && <p className="text-[13px] text-[var(--sem-err)]">{error}</p>}
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
