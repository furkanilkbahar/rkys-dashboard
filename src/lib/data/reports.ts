import "server-only";

import { createClient } from "@/lib/supabase/server";

export type RevenueReport = {
  revenueMinor: number;
  cashMinor: number;
  cardManualMinor: number;
  onlineMinor: number;
  tipsMinor: number;
  compsMinor: number;
  refundsMinor: number;
};

export type TopProductRow = { productName: string; quantity: number; revenueMinor: number };
export type HourlyDensityRow = { hour: number; orderCount: number };
export type MarginRow = { productName: string; quantity: number; revenueMinor: number; costMinor: number; marginMinor: number };
export type ShiftForDate = {
  shiftId: string;
  openedAt: string;
  closedAt: string | null;
  openingBalanceMinor: number;
  countedCashMinor: number | null;
  expectedCashMinor: number | null;
  varianceMinor: number | null;
  status: "open" | "closed";
};
export type DayClosure = {
  id: string;
  businessDate: string;
  revenueMinor: number;
  cashMinor: number;
  cardManualMinor: number;
  onlineMinor: number;
  tipsMinor: number;
  compsMinor: number;
  refundsMinor: number;
  cancelledOrdersCount: number;
  createdAt: string;
};

export async function getRevenueReport(branchId: string, businessDate: string): Promise<RevenueReport | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_revenue_report", { p_branch_id: branchId, p_business_date: businessDate });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    revenueMinor: row.revenue_minor,
    cashMinor: row.cash_minor,
    cardManualMinor: row.card_manual_minor,
    onlineMinor: row.online_minor,
    tipsMinor: row.tips_minor,
    compsMinor: row.comps_minor,
    refundsMinor: row.refunds_minor,
  };
}

export async function getTopProducts(branchId: string, businessDate: string): Promise<TopProductRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_top_products", { p_branch_id: branchId, p_business_date: businessDate });
  return (data ?? []).map((r) => ({ productName: r.product_name, quantity: r.quantity, revenueMinor: r.revenue_minor }));
}

export async function getHourlyDensity(branchId: string, businessDate: string): Promise<HourlyDensityRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_hourly_density", { p_branch_id: branchId, p_business_date: businessDate });
  return (data ?? []).map((r) => ({ hour: r.hour_of_day, orderCount: r.order_count }));
}

export async function getMarginReport(branchId: string, businessDate: string): Promise<MarginRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_margin_report", { p_branch_id: branchId, p_business_date: businessDate });
  return (data ?? []).map((r) => ({
    productName: r.product_name,
    quantity: r.quantity,
    revenueMinor: r.revenue_minor,
    costMinor: r.cost_minor,
    marginMinor: r.margin_minor,
  }));
}

export async function getShiftsForDate(branchId: string, businessDate: string): Promise<ShiftForDate[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_shifts_for_date", { p_branch_id: branchId, p_business_date: businessDate });
  return (data ?? []).map((r) => ({
    shiftId: r.shift_id,
    openedAt: r.opened_at,
    closedAt: r.closed_at,
    openingBalanceMinor: r.opening_balance_minor,
    countedCashMinor: r.counted_cash_minor,
    expectedCashMinor: r.expected_cash_minor,
    varianceMinor: r.variance_minor,
    status: r.status as "open" | "closed",
  }));
}

export async function getDayClosures(tenantId: string, branchId: string): Promise<DayClosure[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("day_closures")
    .select(
      "id, business_date, revenue_minor, cash_minor, card_manual_minor, online_minor, tips_minor, comps_minor, refunds_minor, cancelled_orders_count, created_at",
    )
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .order("business_date", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    businessDate: r.business_date,
    revenueMinor: r.revenue_minor,
    cashMinor: r.cash_minor,
    cardManualMinor: r.card_manual_minor,
    onlineMinor: r.online_minor,
    tipsMinor: r.tips_minor,
    compsMinor: r.comps_minor,
    refundsMinor: r.refunds_minor,
    cancelledOrdersCount: r.cancelled_orders_count,
    createdAt: r.created_at,
  }));
}

export async function isBusinessDateClosed(branchId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_business_date_closed", { p_branch_id: branchId });
  return Boolean(data);
}
