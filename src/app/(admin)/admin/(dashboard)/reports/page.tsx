import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CloseDayButton } from "@/components/admin/close-day-button";
import { ProductCostRow } from "@/components/admin/product-cost-row";
import { can } from "@/lib/auth/can";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminTenantSettings } from "@/lib/data/adminSettings";
import { getDefaultBranchId } from "@/lib/data/branch";
import {
  getCampaignPerformanceReport,
  getLossReport,
  getLoyaltyPerformanceReport,
  getMenuEngineeringMatrix,
  getPeriodRevenueReport,
} from "@/lib/data/periodReports";
import { getProductsWithCosts } from "@/lib/data/productCosts";
import {
  getHourlyDensity,
  getMarginReport,
  getRevenueReport,
  getShiftsForDate,
  getTopProducts,
  isBusinessDateClosed,
} from "@/lib/data/reports";
import { formatPrice } from "@/lib/utils/currency";

import {
  CampaignPerformanceTable,
  LossTable,
  MarginTable,
  MenuEngineeringTable,
  ShiftsTable,
  TopProductsTable,
} from "./report-tables";

// close_business_day/get_revenue_report "business_date"i tenant saat
// diliminde hesaplar (0035, is_business_date_closed) — "bugün" burada da
// aynı saat dilimiyle hesaplanmazsa (ör. sunucu UTC'siyle) tenant'ın
// Istanbul günü ile sunucunun UTC günü farklılaştığı ~3 saatlik pencerede
// rapor yanlış (boş) günü gösterir.
function todayIso(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

// YoY kıyası: aynı aralığın bir önceki yılı — takvim tarihi aritmetiği,
// saat dilimi dönüşümü gerekmez (ikisi de zaten tenant saat dilimindeki
// business_date'ler üzerinden hesaplanmış daily_sales_summary'den gelir).
function shiftYear(dateIso: string, deltaYears: number): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const shifted = new Date(Date.UTC(year + deltaYears, month - 1, day));
  return shifted.toISOString().slice(0, 10);
}

function daysBeforeIso(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day - days));
  return shifted.toISOString().slice(0, 10);
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; periodStart?: string; periodEnd?: string }>;
}) {
  const actor = await requireAdminActor();
  const t = await getTranslations("admin.reports");
  const locale = await getLocale();
  const { date, periodStart, periodEnd } = await searchParams;
  const tenantSettings = await getAdminTenantSettings(actor.tenantId);
  const today = todayIso(tenantSettings?.timezone ?? "UTC");
  const businessDate = date ?? today;
  const periodStartDate = periodStart ?? daysBeforeIso(today, 29);
  const periodEndDate = periodEnd ?? today;

  const canViewRevenue = await can(actor, "reports.revenue");
  if (!canViewRevenue) {
    return (
      <div className="flex flex-col gap-4">
        <AdminPageHeader title={t("title")} />
        <p className="text-sm text-destructive">{t("errors.forbidden")}</p>
      </div>
    );
  }

  const canViewProfit = await can(actor, "reports.profit");
  const canViewLoss = await can(actor, "reports.loss");
  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    notFound();
  }

  const currency = tenantSettings?.currency ?? "TRY";

  const [
    revenue,
    topProducts,
    hourlyDensity,
    shifts,
    dayClosed,
    marginRows,
    products,
    periodRevenue,
    previousYearRevenue,
    lossRows,
    loyaltyPerformance,
    campaignPerformance,
    menuEngineering,
  ] = await Promise.all([
    getRevenueReport(branchId, businessDate),
    getTopProducts(branchId, businessDate),
    getHourlyDensity(branchId, businessDate),
    getShiftsForDate(branchId, businessDate),
    isBusinessDateClosed(branchId),
    canViewProfit ? getMarginReport(branchId, businessDate) : Promise.resolve([]),
    canViewProfit ? getProductsWithCosts(actor.tenantId) : Promise.resolve([]),
    getPeriodRevenueReport(branchId, periodStartDate, periodEndDate),
    getPeriodRevenueReport(branchId, shiftYear(periodStartDate, -1), shiftYear(periodEndDate, -1)),
    canViewLoss ? getLossReport(actor.tenantId, branchId, periodStartDate, periodEndDate, locale) : Promise.resolve([]),
    getLoyaltyPerformanceReport(periodStartDate, periodEndDate),
    getCampaignPerformanceReport(periodStartDate, periodEndDate),
    canViewProfit ? getMenuEngineeringMatrix(branchId, periodStartDate, periodEndDate) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <AdminPageHeader title={t("title")} />
        <form className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="report-date" className="text-sm font-medium">
              {t("date")}
            </label>
            <input
              id="report-date"
              type="date"
              name="date"
              defaultValue={businessDate}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            />
          </div>
          <button type="submit" className="h-8 rounded-lg border border-input px-3 text-sm">
            {t("apply")}
          </button>
        </form>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("revenueTitle")}</h2>
          <a href={`/admin/reports/export?type=revenue&date=${businessDate}`} className="text-sm text-primary underline">
            {t("exportCsv")}
          </a>
        </div>
        {revenue ? (
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <p>{t("revenue")}: {formatPrice(revenue.revenueMinor, currency)}</p>
            <p>{t("cash")}: {formatPrice(revenue.cashMinor, currency)}</p>
            <p>{t("cardManual")}: {formatPrice(revenue.cardManualMinor, currency)}</p>
            <p>{t("online")}: {formatPrice(revenue.onlineMinor, currency)}</p>
            <p>{t("tips")}: {formatPrice(revenue.tipsMinor, currency)}</p>
            <p>{t("comps")}: {formatPrice(revenue.compsMinor, currency)}</p>
            <p>{t("refunds")}: {formatPrice(revenue.refundsMinor, currency)}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("topProductsTitle")}</h2>
          <a href={`/admin/reports/export?type=topProducts&date=${businessDate}`} className="text-sm text-primary underline">
            {t("exportCsv")}
          </a>
        </div>
        <TopProductsTable rows={topProducts} currency={currency} empty={t("empty")} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t("hourlyDensityTitle")}</h2>
        {hourlyDensity.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        <div className="flex flex-wrap gap-2 text-xs">
          {hourlyDensity.map((row) => (
            <span key={row.hour} className="rounded-md border border-border px-2 py-1">
              {row.hour}:00 — {row.orderCount}
            </span>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t("shiftsTitle")}</h2>
        <ShiftsTable
          rows={shifts}
          currency={currency}
          empty={t("empty")}
          statusLabel={{ open: t("status.open"), closed: t("status.closed") }}
        />
      </section>

      {canViewProfit && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{t("marginTitle")}</h2>
            <a href={`/admin/reports/export?type=margin&date=${businessDate}`} className="text-sm text-primary underline">
              {t("exportCsv")}
            </a>
          </div>
          <MarginTable rows={marginRows} currency={currency} empty={t("empty")} />

          <h3 className="text-sm font-semibold">{t("costs.title")}</h3>
          {products.map((product) => (
            <ProductCostRow key={product.productId} product={product} currency={currency} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t("period.title")}</h2>
        <form className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="period-start" className="text-sm font-medium">
              {t("period.start")}
            </label>
            <input
              id="period-start"
              type="date"
              name="periodStart"
              defaultValue={periodStartDate}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="period-end" className="text-sm font-medium">
              {t("period.end")}
            </label>
            <input
              id="period-end"
              type="date"
              name="periodEnd"
              defaultValue={periodEndDate}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            />
          </div>
          <button type="submit" className="h-8 rounded-lg border border-input px-3 text-sm">
            {t("period.apply")}
          </button>
        </form>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <h3 className="text-sm font-semibold">{t("period.currentPeriod")}</h3>
            {periodRevenue ? (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p>{t("revenue")}: {formatPrice(periodRevenue.revenueMinor, currency)}</p>
                <p>{t("period.orderCount")}: {periodRevenue.orderCount}</p>
                <p>{t("comps")}: {formatPrice(periodRevenue.compsMinor, currency)}</p>
                <p>{t("refunds")}: {formatPrice(periodRevenue.refundsMinor, currency)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("period.empty")}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <h3 className="text-sm font-semibold">{t("period.previousYear")}</h3>
            {previousYearRevenue ? (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p>{t("revenue")}: {formatPrice(previousYearRevenue.revenueMinor, currency)}</p>
                <p>{t("period.orderCount")}: {previousYearRevenue.orderCount}</p>
                <p>{t("comps")}: {formatPrice(previousYearRevenue.compsMinor, currency)}</p>
                <p>{t("refunds")}: {formatPrice(previousYearRevenue.refundsMinor, currency)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("period.empty")}</p>
            )}
          </div>
        </div>

        {canViewLoss && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t("period.lossTitle")}</h3>
            <LossTable
              rows={lossRows}
              currency={currency}
              empty={t("period.lossEmpty")}
              sourceLabel={{
                comp: t("period.source.comp"),
                refund: t("period.source.refund"),
                cancel: t("period.source.cancel"),
              }}
              noReasonLabel={t("period.noReason")}
              countLabel={t("period.count")}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("period.loyaltyCampaignTitle")}</h3>
          {loyaltyPerformance && (
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <p>{t("period.pointsEarned")}: {loyaltyPerformance.pointsEarned}</p>
              <p>{t("period.pointsRedeemed")}: {loyaltyPerformance.pointsRedeemed}</p>
              <p>{t("period.activeCustomers")}: {loyaltyPerformance.activeCustomers}</p>
              <p>{t("period.redemptionCount")}: {loyaltyPerformance.redemptionCount}</p>
            </div>
          )}
          <CampaignPerformanceTable
            rows={campaignPerformance}
            currency={currency}
            empty={t("period.campaignEmpty")}
            countLabel={t("period.count")}
          />
        </div>

        {canViewProfit && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t("period.menuEngineeringTitle")}</h3>
            <MenuEngineeringTable
              rows={menuEngineering}
              currency={currency}
              empty={t("period.menuEngineeringEmpty")}
              categoryLabel={{
                star: t("period.menuEngineering.star"),
                plowhorse: t("period.menuEngineering.plowhorse"),
                puzzle: t("period.menuEngineering.puzzle"),
                dog: t("period.menuEngineering.dog"),
              }}
              marginSuffix={t("period.menuEngineeringMargin")}
            />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t("closeDayTitle")}</h2>
        {dayClosed ? <p className="text-sm text-muted-foreground">{t("dayClosed")}</p> : <CloseDayButton branchId={branchId} />}
      </section>
    </div>
  );
}
