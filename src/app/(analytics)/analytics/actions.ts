"use server";

import { revalidatePath } from "next/cache";

import { goalServerSchema } from "@/lib/analytics/schemas";
import { WIDGET_KEYS, type WidgetKey } from "@/lib/analytics/widgets";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { can } from "@/lib/auth/can";
import { saveDashboardWidgetOrder, setDashboardWidgetVisibility } from "@/lib/data/dashboardWidgets";
import { createClient } from "@/lib/supabase/server";

export type DashboardActionResult = { ok: true } | { ok: false; error: "forbidden" | "invalid_input" };

function isWidgetKey(value: string): value is WidgetKey {
  return (WIDGET_KEYS as readonly string[]).includes(value);
}

async function requireAnalyticsActor() {
  const actor = await requireAdminActor();
  if (!(await can(actor, "reports.revenue"))) {
    return null;
  }
  return actor;
}

export async function reorderDashboardWidgets(orderedKeys: string[]): Promise<DashboardActionResult> {
  const actor = await requireAnalyticsActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (!orderedKeys.every(isWidgetKey)) return { ok: false, error: "invalid_input" };

  await saveDashboardWidgetOrder(actor.tenantId, actor.userId, orderedKeys);
  revalidatePath("/analytics");
  return { ok: true };
}

export async function toggleDashboardWidget(widgetKey: string, isVisible: boolean): Promise<DashboardActionResult> {
  const actor = await requireAnalyticsActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (!isWidgetKey(widgetKey)) return { ok: false, error: "invalid_input" };

  await setDashboardWidgetVisibility(actor.tenantId, actor.userId, widgetKey, isVisible);
  revalidatePath("/analytics");
  return { ok: true };
}

export async function setGoal(branchId: string, periodMonth: string, input: unknown): Promise<DashboardActionResult> {
  const actor = await requireAnalyticsActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = goalServerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_monthly_goal", {
    p_branch_id: branchId,
    p_period_month: periodMonth,
    p_target_revenue_minor: parsed.data.targetRevenueMinor,
  });
  if (error) return { ok: false, error: "invalid_input" };

  revalidatePath("/analytics");
  return { ok: true };
}

export async function acknowledgeAlert(alertId: string): Promise<DashboardActionResult> {
  const actor = await requireAnalyticsActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("acknowledge_anomaly_alert", { p_alert_id: alertId });
  if (error) return { ok: false, error: "invalid_input" };

  revalidatePath("/analytics");
  return { ok: true };
}
