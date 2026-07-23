"use server";

import { revalidatePath } from "next/cache";

import { requireAdminActor } from "@/lib/auth/adminGuard";
import { can } from "@/lib/auth/can";
import { WIDGET_KEYS, type WidgetKey } from "@/lib/analytics/widgets";
import { saveDashboardWidgetOrder, setDashboardWidgetVisibility } from "@/lib/data/dashboardWidgets";

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
