"use client";

import { EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { SortableList } from "@/components/admin/sortable-list";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WidgetKey } from "@/lib/analytics/widgets";
import type { BranchComparisonRow } from "@/lib/data/periodReports";
import type { HourlyDensityRow, RevenueReport, TopProductRow } from "@/lib/data/reports";
import { formatPrice } from "@/lib/utils/currency";

type WidgetLayoutItem = { widgetKey: WidgetKey; position: number; isVisible: boolean };

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground">{label}</p>;
}

const CHART_TICK_STYLE = { fontSize: 12, fill: "var(--muted-foreground)" };
const TOOLTIP_STYLE = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 };

export function AnalyticsDashboard({
  layout,
  currency,
  revenueToday,
  orderCountToday,
  hourlyDensity,
  topProducts,
  branchComparison,
  reorderWidgets,
  toggleWidget,
}: {
  layout: WidgetLayoutItem[];
  currency: string;
  revenueToday: RevenueReport | null;
  orderCountToday: number;
  hourlyDensity: HourlyDensityRow[];
  topProducts: TopProductRow[];
  branchComparison: BranchComparisonRow[];
  reorderWidgets: (orderedKeys: string[]) => Promise<unknown>;
  toggleWidget: (widgetKey: string, isVisible: boolean) => Promise<unknown>;
}) {
  const t = useTranslations("admin.analytics");
  const router = useRouter();
  const visible = layout.filter((item) => item.isVisible);
  const hidden = layout.filter((item) => !item.isVisible);

  async function handleHide(widgetKey: WidgetKey) {
    await toggleWidget(widgetKey, false);
    router.refresh();
  }

  async function handleShow(widgetKey: WidgetKey) {
    await toggleWidget(widgetKey, true);
    router.refresh();
  }

  function renderWidgetContent(widgetKey: WidgetKey) {
    switch (widgetKey) {
      case "revenue_today":
        return revenueToday ? (
          <p className="text-3xl font-semibold tabular-nums">{formatPrice(revenueToday.revenueMinor, currency)}</p>
        ) : (
          <EmptyState label={t("empty")} />
        );

      case "order_count_today":
        return <p className="text-3xl font-semibold tabular-nums">{orderCountToday}</p>;

      case "hourly_density":
        if (hourlyDensity.length === 0) return <EmptyState label={t("empty")} />;
        return (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyDensity.map((r) => ({ hour: `${r.hour}:00`, count: r.orderCount }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="hour" tick={CHART_TICK_STYLE} interval={2} />
              <YAxis allowDecimals={false} tick={CHART_TICK_STYLE} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(label) => label} formatter={(value) => [Number(value), t("orderCount")]} />
              <Bar dataKey="count" name={t("orderCount")} fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "top_products": {
        const rows = topProducts.slice(0, 5);
        if (rows.length === 0) return <EmptyState label={t("empty")} />;
        return (
          <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 40)}>
            <BarChart data={rows.map((r) => ({ name: r.productName, revenue: r.revenueMinor / 100 }))} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={CHART_TICK_STYLE} />
              <YAxis type="category" dataKey="name" width={100} tick={CHART_TICK_STYLE} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [formatPrice(Number(value) * 100, currency), t("revenue")]} />
              <Bar dataKey="revenue" name={t("revenue")} fill="var(--primary)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      }

      case "branch_comparison":
        if (branchComparison.length === 0) return <EmptyState label={t("empty")} />;
        return (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={branchComparison.map((r) => ({ name: r.branchName, revenue: r.revenueMinor / 100 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={CHART_TICK_STYLE} />
              <YAxis tick={CHART_TICK_STYLE} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [formatPrice(Number(value) * 100, currency), t("revenue")]} />
              <Bar dataKey="revenue" name={t("revenue")} fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SortableList
        items={visible.map((item) => ({ id: item.widgetKey, ...item }))}
        onReorder={reorderWidgets}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        renderItem={(item, dragHandle) => (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">{t(`widgets.${item.widgetKey}`)}</CardTitle>
              <CardAction className="flex items-center gap-1">
                <span className="flex size-11 items-center justify-center">{dragHandle}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={t("hideWidget", { widget: t(`widgets.${item.widgetKey}`) })}
                  onClick={() => handleHide(item.widgetKey)}
                >
                  <EyeOff className="size-4" aria-hidden="true" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>{renderWidgetContent(item.widgetKey)}</CardContent>
          </Card>
        )}
      />

      {hidden.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border p-3 text-sm">
          <span className="text-muted-foreground">{t("hiddenWidgets")}</span>
          {hidden.map((item) => (
            <Button key={item.widgetKey} type="button" variant="outline" size="sm" onClick={() => handleShow(item.widgetKey)}>
              {t(`widgets.${item.widgetKey}`)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
