import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CashierTable = {
  id: string;
  label: string;
  isCounter: boolean;
};

export async function getCashierTables(tenantId: string, branchId: string): Promise<CashierTable[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tables")
    .select("id, label, is_counter")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("is_counter", { ascending: false })
    .order("label");

  return (data ?? []).map((t) => ({ id: t.id, label: t.label, isCounter: t.is_counter }));
}

export type OpenCashShift = {
  id: string;
  openingBalanceMinor: number;
  openedAt: string;
};

export async function getOpenShift(tenantId: string, branchId: string): Promise<OpenCashShift | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cash_shifts")
    .select("id, opening_balance_minor, opened_at")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("status", "open")
    .maybeSingle();

  if (!data) {
    return null;
  }

  return { id: data.id, openingBalanceMinor: data.opening_balance_minor, openedAt: data.opened_at };
}

export type CashMovement = {
  id: string;
  movementType: "sale" | "cash_in" | "cash_out" | "refund";
  amountMinor: number;
  note: string | null;
  createdAt: string;
};

export async function getShiftMovements(shiftId: string): Promise<CashMovement[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cash_movements")
    .select("id, movement_type, amount_minor, note, created_at")
    .eq("cash_shift_id", shiftId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((m) => ({
    id: m.id,
    movementType: m.movement_type as CashMovement["movementType"],
    amountMinor: m.amount_minor,
    note: m.note,
    createdAt: m.created_at,
  }));
}

export type SessionBalance = {
  tableSessionId: string;
  tableLabel: string;
  subtotalMinor: number;
  paidMinor: number;
  balanceMinor: number;
  checkRequested: boolean;
};

/**
 * Kasa ödeme ekranının masa/oturum seçicisi: bakiyesi > 0 olan tüm aktif
 * oturumlar (yalnız "Hesap İste" bekleyenler değil — personel istediği anda
 * herhangi bir aktif hesabı kapatabilmeli), check-request'i olanlar üstte.
 */
export async function getActiveSessionBalances(tenantId: string, branchId: string): Promise<SessionBalance[]> {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("table_sessions")
    .select("id, tables(label)")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("status", "active");

  if (!sessions || sessions.length === 0) {
    return [];
  }

  const sessionIds = sessions.map((s) => s.id);

  const [ordersRes, paymentsRes, checkCallsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, table_session_id, subtotal_minor")
      .in("table_session_id", sessionIds)
      .neq("status", "cancelled"),
    supabase
      .from("payments")
      .select("table_session_id, amount_minor")
      .in("table_session_id", sessionIds)
      .eq("status", "completed"),
    supabase
      .from("waiter_calls")
      .select("table_session_id, call_types(key)")
      .in("table_session_id", sessionIds)
      .eq("status", "open"),
  ]);

  const sessionByOrderId = new Map<string, string>();
  const subtotalBySession = new Map<string, number>();
  for (const row of ordersRes.data ?? []) {
    sessionByOrderId.set(row.id, row.table_session_id);
    subtotalBySession.set(row.table_session_id, (subtotalBySession.get(row.table_session_id) ?? 0) + row.subtotal_minor);
  }

  const orderIds = [...sessionByOrderId.keys()];
  const compsRes = orderIds.length > 0 ? await supabase.from("comps").select("order_id, amount_minor").in("order_id", orderIds) : { data: [] };
  const compedBySession = new Map<string, number>();
  for (const row of compsRes.data ?? []) {
    const sid = sessionByOrderId.get(row.order_id);
    if (sid) compedBySession.set(sid, (compedBySession.get(sid) ?? 0) + row.amount_minor);
  }

  const paidBySession = new Map<string, number>();
  for (const row of paymentsRes.data ?? []) {
    paidBySession.set(row.table_session_id, (paidBySession.get(row.table_session_id) ?? 0) + row.amount_minor);
  }
  const checkRequestedSessions = new Set(
    (checkCallsRes.data ?? []).filter((row) => row.call_types?.key === "check").map((row) => row.table_session_id),
  );

  return sessions
    .map((s) => {
      const subtotalMinor = (subtotalBySession.get(s.id) ?? 0) - (compedBySession.get(s.id) ?? 0);
      const paidMinor = paidBySession.get(s.id) ?? 0;
      return {
        tableSessionId: s.id,
        tableLabel: s.tables?.label ?? "?",
        subtotalMinor,
        paidMinor,
        balanceMinor: subtotalMinor - paidMinor,
        checkRequested: checkRequestedSessions.has(s.id),
      };
    })
    .filter((s) => s.balanceMinor > 0)
    .sort((a, b) => Number(b.checkRequested) - Number(a.checkRequested));
}

export type RefundableItem = {
  orderItemId: string;
  name: string;
  variantName: string | null;
  unitPriceMinor: number;
  remainingQuantity: number;
};

export type RecentPayment = {
  id: string;
  tableLabel: string;
  method: "cash" | "card_manual" | "online";
  provider: string;
  amountMinor: number;
  tipAmountMinor: number;
  refundedMinor: number;
  status: "pending" | "completed" | "failed" | "refunded" | "partially_refunded";
  createdAt: string;
  refundableItems: RefundableItem[];
};

// İade akışı için son ödemeler (S11, kısmi/kalem iade Faz 6 Adım 1): şubenin
// en son N ödemesi + kalan iade edilebilir tutar + (varsa) kalem bazlı iade
// için kalan miktarlar. refundableItems yalnızca "kalem seç" modunda ödenmiş
// payment_item_allocations'ı olan ödemeler için doludur.
export async function getRecentPayments(tenantId: string, branchId: string, limit = 20): Promise<RecentPayment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id, method, provider, amount_minor, tip_amount_minor, status, created_at, table_sessions(tables(label))")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .in("status", ["completed", "refunded", "partially_refunded"])
    .order("created_at", { ascending: false })
    .limit(limit);

  const payments = data ?? [];
  const paymentIds = payments.map((p) => p.id);
  if (paymentIds.length === 0) return [];

  const [refundsRes, allocationsRes] = await Promise.all([
    supabase.from("refunds").select("id, payment_id, amount_minor").in("payment_id", paymentIds),
    supabase
      .from("payment_item_allocations")
      .select("payment_id, order_item_id, quantity, order_items(product_name_snapshot, variant_name_snapshot, unit_price_minor)")
      .in("payment_id", paymentIds),
  ]);

  const refundedMinorByPayment = new Map<string, number>();
  const refundIdsByPayment = new Map<string, string[]>();
  for (const r of refundsRes.data ?? []) {
    refundedMinorByPayment.set(r.payment_id, (refundedMinorByPayment.get(r.payment_id) ?? 0) + r.amount_minor);
    refundIdsByPayment.set(r.payment_id, [...(refundIdsByPayment.get(r.payment_id) ?? []), r.id]);
  }

  const allRefundIds = [...refundIdsByPayment.values()].flat();
  const refundedQuantityByItem = new Map<string, number>();
  if (allRefundIds.length > 0) {
    const { data: refundAllocations } = await supabase
      .from("refund_item_allocations")
      .select("refund_id, order_item_id, quantity")
      .in("refund_id", allRefundIds);
    for (const ra of refundAllocations ?? []) {
      refundedQuantityByItem.set(ra.order_item_id, (refundedQuantityByItem.get(ra.order_item_id) ?? 0) + ra.quantity);
    }
  }

  const refundableItemsByPayment = new Map<string, RefundableItem[]>();
  for (const a of allocationsRes.data ?? []) {
    const remainingQuantity = a.quantity - (refundedQuantityByItem.get(a.order_item_id) ?? 0);
    if (remainingQuantity <= 0 || !a.order_items) continue;
    const list = refundableItemsByPayment.get(a.payment_id) ?? [];
    list.push({
      orderItemId: a.order_item_id,
      name: a.order_items.product_name_snapshot,
      variantName: a.order_items.variant_name_snapshot,
      unitPriceMinor: a.order_items.unit_price_minor,
      remainingQuantity,
    });
    refundableItemsByPayment.set(a.payment_id, list);
  }

  return payments.map((p) => ({
    id: p.id,
    tableLabel: p.table_sessions?.tables?.label ?? "?",
    method: p.method as RecentPayment["method"],
    provider: p.provider,
    amountMinor: p.amount_minor,
    tipAmountMinor: p.tip_amount_minor,
    refundedMinor: refundedMinorByPayment.get(p.id) ?? 0,
    status: p.status as RecentPayment["status"],
    createdAt: p.created_at,
    refundableItems: refundableItemsByPayment.get(p.id) ?? [],
  }));
}

export type ClosedCashShift = {
  id: string;
  openingBalanceMinor: number;
  countedCashMinor: number | null;
  expectedCashMinor: number | null;
  varianceMinor: number | null;
  closedAt: string | null;
};

export async function getLastClosedShift(tenantId: string, branchId: string): Promise<ClosedCashShift | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cash_shifts")
    .select("id, opening_balance_minor, counted_cash_minor, expected_cash_minor, variance_minor, closed_at")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("status", "closed")
    .order("closed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    openingBalanceMinor: data.opening_balance_minor,
    countedCashMinor: data.counted_cash_minor,
    expectedCashMinor: data.expected_cash_minor,
    varianceMinor: data.variance_minor,
    closedAt: data.closed_at,
  };
}
