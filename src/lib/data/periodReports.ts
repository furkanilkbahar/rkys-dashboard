import "server-only";

import { createClient } from "@/lib/supabase/server";

export type PeriodRevenueReport = {
  revenueMinor: number;
  cashMinor: number;
  cardManualMinor: number;
  onlineMinor: number;
  tipsMinor: number;
  compsMinor: number;
  refundsMinor: number;
  orderCount: number;
};

export type BranchComparisonRow = { branchId: string; branchName: string; revenueMinor: number; orderCount: number };

export type LossReportSource = "comp" | "refund" | "cancel";
export type LossReportRow = {
  source: LossReportSource;
  reasonCodeId: string | null;
  reasonKey: string | null;
  amountMinor: number;
  itemCount: number;
};

export async function getPeriodRevenueReport(
  branchId: string,
  startDate: string,
  endDate: string,
): Promise<PeriodRevenueReport | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_period_revenue_report", {
    p_branch_id: branchId,
    p_start_date: startDate,
    p_end_date: endDate,
  });
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
    orderCount: row.order_count,
  };
}

export async function getBranchComparison(startDate: string, endDate: string): Promise<BranchComparisonRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_branch_comparison", { p_start_date: startDate, p_end_date: endDate });
  return (data ?? []).map((r) => ({
    branchId: r.branch_id,
    branchName: r.branch_name,
    revenueMinor: r.revenue_minor,
    orderCount: r.order_count,
  }));
}

// reason_code display adı content_translations'tan gelir (getReasonCodeOptions
// ile aynı desen) — key, çeviri yoksa (veya reason_code_id null ise, ör.
// sebepsiz iptal) fallback olarak kullanılır.
export async function getLossReport(
  tenantId: string,
  branchId: string,
  startDate: string,
  endDate: string,
  locale: string,
): Promise<LossReportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_loss_report", {
    p_branch_id: branchId,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  const rows = data ?? [];
  const reasonCodeIds = [...new Set(rows.map((r) => r.reason_code_id).filter((id): id is string => id !== null))];

  const nameMap = new Map<string, string>();
  if (reasonCodeIds.length > 0) {
    const { data: translations } = await supabase
      .from("content_translations")
      .select("entity_id, value")
      .eq("tenant_id", tenantId)
      .eq("entity_type", "reason_code")
      .eq("field", "name")
      .eq("locale", locale)
      .in("entity_id", reasonCodeIds);
    for (const row of translations ?? []) {
      nameMap.set(row.entity_id, row.value);
    }
  }

  return rows.map((r) => ({
    source: r.source as LossReportSource,
    reasonCodeId: r.reason_code_id,
    reasonKey: r.reason_code_id ? (nameMap.get(r.reason_code_id) ?? r.reason_key) : null,
    amountMinor: r.amount_minor,
    itemCount: r.item_count,
  }));
}

export type LoyaltyPerformanceReport = {
  pointsEarned: number;
  pointsRedeemed: number;
  activeCustomers: number;
  redemptionCount: number;
};

export async function getLoyaltyPerformanceReport(startDate: string, endDate: string): Promise<LoyaltyPerformanceReport | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_loyalty_performance_report", { p_start_date: startDate, p_end_date: endDate });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    pointsEarned: row.points_earned,
    pointsRedeemed: row.points_redeemed,
    activeCustomers: row.active_customers,
    redemptionCount: row.redemption_count,
  };
}

export type CampaignPerformanceRow = {
  campaignId: string;
  campaignName: string;
  redemptionCount: number;
  totalDiscountMinor: number;
};

export async function getCampaignPerformanceReport(startDate: string, endDate: string): Promise<CampaignPerformanceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_campaign_performance_report", { p_start_date: startDate, p_end_date: endDate });
  return (data ?? []).map((r) => ({
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    redemptionCount: r.redemption_count,
    totalDiscountMinor: r.total_discount_minor,
  }));
}

export type MenuEngineeringCategory = "star" | "plowhorse" | "puzzle" | "dog";
export type MenuEngineeringRow = {
  productName: string;
  quantity: number;
  revenueMinor: number;
  costMinor: number;
  marginMinor: number;
  category: MenuEngineeringCategory;
};

export async function getMenuEngineeringMatrix(branchId: string, startDate: string, endDate: string): Promise<MenuEngineeringRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_menu_engineering_matrix", { p_branch_id: branchId, p_start_date: startDate, p_end_date: endDate });
  return (data ?? []).map((r) => ({
    productName: r.product_name,
    quantity: r.quantity,
    revenueMinor: r.revenue_minor,
    costMinor: r.cost_minor,
    marginMinor: r.margin_minor,
    category: r.category as MenuEngineeringCategory,
  }));
}
