import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { can } from "@/lib/auth/can";
import { getAdminTenantSettings } from "@/lib/data/adminSettings";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getDashboardWidgetLayout } from "@/lib/data/dashboardWidgets";
import { getActiveAnomalyAlerts, getGoalProgress } from "@/lib/data/goals";
import { getBranchComparison } from "@/lib/data/periodReports";
import { getHourlyDensity, getRevenueReport, getTopProducts } from "@/lib/data/reports";
import { isSubscriptionActive } from "@/lib/data/subscription";

import { acknowledgeAlert, reorderDashboardWidgets, setGoal, toggleDashboardWidget } from "./actions";

function todayIso(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

function daysBeforeIso(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
}

export default async function AnalyticsHomePage() {
  const actor = await requireAdminActor();
  if (!(await isSubscriptionActive(actor.tenantId))) {
    redirect("/admin/billing");
  }

  const t = await getTranslations("admin.analytics");
  const canView = await can(actor, "reports.revenue");
  if (!canView) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-destructive">{t("forbidden")}</p>
      </div>
    );
  }

  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    notFound();
  }

  const tenantSettings = await getAdminTenantSettings(actor.tenantId);
  const currency = tenantSettings?.currency ?? "TRY";
  const today = todayIso(tenantSettings?.timezone ?? "UTC");

  const currentMonth = `${today.slice(0, 7)}-01`;

  const [revenueToday, hourlyDensity, topProducts, branchComparison, layout, goalProgress, anomalyAlerts] = await Promise.all([
    getRevenueReport(branchId, today),
    getHourlyDensity(branchId, today),
    getTopProducts(branchId, today),
    getBranchComparison(daysBeforeIso(today, 29), today),
    getDashboardWidgetLayout(actor.userId),
    getGoalProgress(branchId, currentMonth),
    getActiveAnomalyAlerts(branchId),
  ]);
  const orderCountToday = hourlyDensity.reduce((sum, row) => sum + row.orderCount, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <AnalyticsDashboard
        layout={layout}
        currency={currency}
        branchId={branchId}
        periodMonth={currentMonth}
        revenueToday={revenueToday}
        orderCountToday={orderCountToday}
        hourlyDensity={hourlyDensity}
        topProducts={topProducts}
        branchComparison={branchComparison}
        goalProgress={goalProgress}
        anomalyAlerts={anomalyAlerts}
        reorderWidgets={reorderDashboardWidgets}
        toggleWidget={toggleDashboardWidget}
        setGoal={setGoal}
        acknowledgeAlert={acknowledgeAlert}
      />
    </div>
  );
}
