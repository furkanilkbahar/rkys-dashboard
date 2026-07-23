import "server-only";

import { createClient } from "@/lib/supabase/server";

export type GoalProgress = { targetRevenueMinor: number; actualRevenueMinor: number };
export type AnomalyAlert = { id: string; businessDate: string; message: string; createdAt: string };

export async function getGoalProgress(branchId: string, periodMonth: string): Promise<GoalProgress> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_goal_progress", { p_branch_id: branchId, p_period_month: periodMonth });
  const row = data?.[0];
  return { targetRevenueMinor: row?.target_revenue_minor ?? 0, actualRevenueMinor: row?.actual_revenue_minor ?? 0 };
}

export async function getActiveAnomalyAlerts(branchId: string): Promise<AnomalyAlert[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_active_anomaly_alerts", { p_branch_id: branchId });
  return (data ?? []).map((r) => ({ id: r.id, businessDate: r.business_date, message: r.message, createdAt: r.created_at }));
}
