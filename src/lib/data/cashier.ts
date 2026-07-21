import "server-only";

import { createClient } from "@/lib/supabase/server";

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
