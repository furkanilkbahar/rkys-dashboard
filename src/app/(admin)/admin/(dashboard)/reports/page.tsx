import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CloseDayButton } from "@/components/admin/close-day-button";
import { ProductCostRow } from "@/components/admin/product-cost-row";
import { can } from "@/lib/auth/can";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminTenantSettings } from "@/lib/data/adminSettings";
import { getDefaultBranchId } from "@/lib/data/branch";
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

// close_business_day/get_revenue_report "business_date"i tenant saat
// diliminde hesaplar (0035, is_business_date_closed) — "bugün" burada da
// aynı saat dilimiyle hesaplanmazsa (ör. sunucu UTC'siyle) tenant'ın
// Istanbul günü ile sunucunun UTC günü farklılaştığı ~3 saatlik pencerede
// rapor yanlış (boş) günü gösterir.
function todayIso(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const actor = await requireAdminActor();
  const t = await getTranslations("admin.reports");
  const { date } = await searchParams;
  const tenantSettings = await getAdminTenantSettings(actor.tenantId);
  const businessDate = date ?? todayIso(tenantSettings?.timezone ?? "UTC");

  const canViewRevenue = await can(actor, "reports.revenue");
  if (!canViewRevenue) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-destructive">{t("errors.forbidden")}</p>
      </div>
    );
  }

  const canViewProfit = await can(actor, "reports.profit");
  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    notFound();
  }

  const currency = tenantSettings?.currency ?? "TRY";

  const [revenue, topProducts, hourlyDensity, shifts, dayClosed, marginRows, products] = await Promise.all([
    getRevenueReport(branchId, businessDate),
    getTopProducts(branchId, businessDate),
    getHourlyDensity(branchId, businessDate),
    getShiftsForDate(branchId, businessDate),
    isBusinessDateClosed(branchId),
    canViewProfit ? getMarginReport(branchId, businessDate) : Promise.resolve([]),
    canViewProfit ? getProductsWithCosts(actor.tenantId) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <form className="flex items-end gap-2">
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
        {topProducts.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        {topProducts.map((row) => (
          <div key={row.productName} className="flex items-center justify-between text-sm">
            <span>{row.productName}</span>
            <span>
              {row.quantity} × — {formatPrice(row.revenueMinor, currency)}
            </span>
          </div>
        ))}
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
        {shifts.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        {shifts.map((shift) => (
          <div key={shift.shiftId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
            <span>{t(`status.${shift.status}`)}</span>
            <span>
              {t("expected")}: {shift.expectedCashMinor !== null ? formatPrice(shift.expectedCashMinor, currency) : "—"}
            </span>
            <span>
              {t("counted")}: {shift.countedCashMinor !== null ? formatPrice(shift.countedCashMinor, currency) : "—"}
            </span>
            <span>
              {t("variance")}: {shift.varianceMinor !== null ? formatPrice(shift.varianceMinor, currency) : "—"}
            </span>
          </div>
        ))}
      </section>

      {canViewProfit && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{t("marginTitle")}</h2>
            <a href={`/admin/reports/export?type=margin&date=${businessDate}`} className="text-sm text-primary underline">
              {t("exportCsv")}
            </a>
          </div>
          {marginRows.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
          {marginRows.map((row) => (
            <div key={row.productName} className="flex items-center justify-between text-sm">
              <span>{row.productName}</span>
              <span>
                {formatPrice(row.revenueMinor, currency)} − {formatPrice(row.costMinor, currency)} = {formatPrice(row.marginMinor, currency)}
              </span>
            </div>
          ))}

          <h3 className="text-sm font-semibold">{t("costs.title")}</h3>
          {products.map((product) => (
            <ProductCostRow key={product.productId} product={product} currency={currency} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t("closeDayTitle")}</h2>
        {dayClosed ? <p className="text-sm text-muted-foreground">{t("dayClosed")}</p> : <CloseDayButton branchId={branchId} />}
      </section>
    </div>
  );
}
