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

export type RecentPayment = {
  id: string;
  tableLabel: string;
  method: "cash" | "card_manual" | "online";
  provider: string;
  amountMinor: number;
  tipAmountMinor: number;
  status: "pending" | "completed" | "failed" | "refunded";
  createdAt: string;
};

// İade akışı için son ödemeler (S11): şubenin en son N ödemesi, iade
// düğmesinin hedefleyeceği liste. Gün sonu/raporlama Adım 6'da ayrı bir
// business-date bazlı sorgu ile gelecek — burası yalnızca kasa ekranının
// "son işlemler" görünümü.
export async function getRecentPayments(tenantId: string, branchId: string, limit = 20): Promise<RecentPayment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id, method, provider, amount_minor, tip_amount_minor, status, created_at, table_sessions(tables(label))")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .in("status", ["completed", "refunded"])
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((p) => ({
    id: p.id,
    tableLabel: p.table_sessions?.tables?.label ?? "?",
    method: p.method as RecentPayment["method"],
    provider: p.provider,
    amountMinor: p.amount_minor,
    tipAmountMinor: p.tip_amount_minor,
    status: p.status as RecentPayment["status"],
    createdAt: p.created_at,
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
