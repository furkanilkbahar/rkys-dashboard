import { getLocale, getTranslations } from "next-intl/server";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  AttentionItem,
  DashboardAllClear,
  DashboardSection,
  NowStat,
  QuickLink,
} from "@/components/admin/dashboard-panels";
import { MetaChip } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { can } from "@/lib/auth/can";
import { getAdminModules, getAdminTenantSettings } from "@/lib/data/adminSettings";
import { getAdminTables } from "@/lib/data/adminTables";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getRevenueTrend, getTodayOrderCount } from "@/lib/data/dashboard";
import { getAdminIngredients } from "@/lib/data/ingredients";
import { getUpcomingReservations } from "@/lib/data/reservations";
import { getRevenueReport, getTopProducts } from "@/lib/data/reports";
import { getOrdersByStatus } from "@/lib/data/staffOrders";
import { getAdminSupportTickets } from "@/lib/data/supportTickets";
import { getOccupiedTables } from "@/lib/data/tableSessions";
import { getAdminTenantName } from "@/lib/data/tenant";
import { getOpenWaiterCalls } from "@/lib/data/waiterCalls";
import { formatPrice } from "@/lib/utils/currency";

import { DashboardTopProducts } from "./top-products";

/**
 * Faz 23 Adım 2 — Pano.
 *
 * ÖNCESİ: tek bir kart, içinde işletmenin adı. 33 sayfalık bir panelin giriş
 * ekranı olarak hiçbir soruya cevap vermiyordu.
 *
 * BU PANONUN CEVAPLADIĞI DÖRT SORU (araştırılan restoran SaaS panolarının —
 * Toast, Square for Restaurants, Lightspeed — yakınsadığı hiyerarşi):
 *   1. Bugün nasıl gidiyor?      → KPI şeridi, her kart dayandığı rapora gider
 *   2. Şu anda ne oluyor?        → dolu masa / bekleyen çağrı / mutfak yükü
 *   3. Neye bakmam gerekiyor?    → dikkat listesi (asıl işlev bu)
 *   4. Sık yaptığım işler nerede? → hızlı işlemler
 *
 * KESİN KURAL — UYDURMA YOK (RULES: uydurma iddia yasak): buradaki her sayı
 * gerçek bir sorgudan gelir. Kapanmış gün yoksa sparkline HİÇ çizilmez, sıfırla
 * doldurulmaz. `reports.revenue` izni yoksa ciro/ortalama sepet kartları hiç
 * render edilmez (RULES #41). Kapalı modülün bölümü (stok, rezervasyon) hiç
 * çizilmez (RULES #34).
 */

// Rapor sayfasındaki `todayIso` ile AYNI hesap: business_date tenant saat
// diliminde belirlenir (0035). Sunucunun UTC günüyle hesaplansaydı, tenant'ın
// Istanbul günü ile UTC'nin ayrıldığı ~3 saatlik pencerede pano boş bir gün
// gösterirdi.
function todayIso(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

export default async function AdminDashboardPage() {
  const actor = await requireAdminActor();
  const t = await getTranslations("admin.dashboard");
  const locale = await getLocale();

  const [tenantName, settings, modules, branchId] = await Promise.all([
    getAdminTenantName(actor.tenantId),
    getAdminTenantSettings(actor.tenantId),
    getAdminModules(actor.tenantId),
    getDefaultBranchId(actor.tenantId),
  ]);

  const currency = settings?.currency ?? "TRY";
  const timezone = settings?.timezone ?? "UTC";
  const today = todayIso(timezone);
  const enabled = new Set(modules.filter((m) => m.isEnabled).map((m) => m.moduleKey));

  const canViewRevenue = await can(actor, "reports.revenue");

  // Şube çözülemezse (yeni tenant, henüz şube yok) şubeye bağlı hiçbir sorgu
  // çalıştırılmaz — boş sonuç yerine yanlış bir "0" göstermek daha kötü olurdu.
  const [
    revenue,
    trend,
    orderCountToday,
    tables,
    occupied,
    calls,
    kitchenOrders,
    topProducts,
    ingredients,
    tickets,
    reservations,
  ] = await Promise.all([
      branchId && canViewRevenue ? getRevenueReport(branchId, today) : Promise.resolve(null),
      branchId && canViewRevenue ? getRevenueTrend(branchId) : Promise.resolve([]),
      branchId ? getTodayOrderCount(branchId, timezone, today) : Promise.resolve(0),
      branchId ? getAdminTables(actor.tenantId, branchId) : Promise.resolve([]),
      branchId ? getOccupiedTables(actor.tenantId, branchId) : Promise.resolve([]),
      branchId ? getOpenWaiterCalls(actor.tenantId, branchId, locale) : Promise.resolve([]),
      branchId
        ? getOrdersByStatus(actor.tenantId, branchId, ["pending", "approved", "preparing", "ready"])
        : Promise.resolve([]),
      branchId && canViewRevenue ? getTopProducts(branchId, today) : Promise.resolve([]),
      enabled.has("inventory") ? getAdminIngredients(actor.tenantId) : Promise.resolve([]),
      getAdminSupportTickets(actor.tenantId),
      enabled.has("reservations") && branchId
        ? getUpcomingReservations(actor.tenantId, branchId, 5)
        : Promise.resolve([]),
    ]);

  const activeTables = tables.filter((table) => table.isActive);
  const criticalIngredients = ingredients.filter(
    (ingredient) => ingredient.isActive && ingredient.currentStock <= ingredient.criticalLevel,
  );
  const openTickets = tickets.filter((ticket) => ticket.status === "open");

  const pendingApproval = kitchenOrders.filter((order) => order.status === "pending").length;
  const inKitchen = kitchenOrders.filter(
    (order) => order.status === "approved" || order.status === "preparing",
  ).length;
  const readyToServe = kitchenOrders.filter((order) => order.status === "ready").length;

  // Sparkline yalnızca GERÇEK bir seri varsa. `daily_sales_summary`'ye sadece
  // kapatılmış günler girer; hiç kapanış yoksa seri boş kalır ve StatCard
  // çizgiyi hiç çizmez (uydurma nokta üretilmez).
  const revenueSeries = trend.length >= 2 ? trend.map((point) => point.revenueMinor) : undefined;
  const orderSeries = trend.length >= 2 ? trend.map((point) => point.orderCount) : undefined;

  // Ortalama sepet, GÜNÜN cirosunun GÜNÜN sipariş sayısına bölümü. Payda
  // olarak "açık sipariş" sayısını kullanmak (ilk taslakta öyleydi) rakamı
  // gün ilerledikçe şişiren bir hata olurdu — servis edilen siparişler
  // paydadan düşer, ciro düşmezdi.
  const averageTicketMinor =
    revenue && revenue.revenueMinor > 0 && orderCountToday > 0
      ? Math.round(revenue.revenueMinor / orderCountToday)
      : null;

  const reportsHref = `/admin/reports?date=${today}`;
  const dateLabel = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    weekday: "long",
    timeZone: timezone,
  }).format(new Date());

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader title={t("welcome", { tenantName: tenantName ?? "—" })} meta={<MetaChip>{dateLabel}</MetaChip>} />

      {canViewRevenue && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <StatCard
            label={t("kpi.revenueToday")}
            value={formatPrice(revenue?.revenueMinor ?? 0, currency)}
            series={revenueSeries}
            href={reportsHref}
            footer={trend.length >= 2 ? t("kpi.trendFooter", { days: trend.length }) : t("kpi.noTrendYet")}
          />
          <StatCard
            label={t("kpi.ordersToday")}
            value={orderCountToday}
            tone="info"
            series={orderSeries}
            href={reportsHref}
          />
          <StatCard
            label={t("kpi.averageTicket")}
            value={averageTicketMinor === null ? "—" : formatPrice(averageTicketMinor, currency)}
            tone="ok"
            href={reportsHref}
            footer={averageTicketMinor === null ? t("kpi.averageTicketEmpty") : undefined}
          />
          <StatCard
            label={t("kpi.tips")}
            value={formatPrice(revenue?.tipsMinor ?? 0, currency)}
            tone="warn"
            href={reportsHref}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DashboardSection title={t("now.title")} href="/kitchen" linkLabel={t("now.openKds")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <NowStat
              label={t("now.occupiedTables", { total: activeTables.length })}
              value={occupied.length}
              href="/admin/tables"
              tone={occupied.length > 0 ? "ok" : "neutral"}
            />
            <NowStat
              label={t("now.openCalls")}
              value={calls.length}
              href="/waiter"
              tone={calls.length > 0 ? "err" : "neutral"}
            />
            <NowStat
              label={t("now.pendingApproval")}
              value={pendingApproval}
              href="/waiter"
              tone={pendingApproval > 0 ? "warn" : "neutral"}
            />
            <NowStat label={t("now.inKitchen")} value={inKitchen} href="/kitchen" />
            <NowStat
              label={t("now.readyToServe")}
              value={readyToServe}
              href="/kitchen"
              tone={readyToServe > 0 ? "ok" : "neutral"}
            />
            <NowStat label={t("now.activeTables")} value={activeTables.length} href="/admin/tables" />
          </div>
        </DashboardSection>

        <DashboardSection title={t("attention.title")}>
          <div className="flex flex-col">
            {calls.length > 0 && (
              <AttentionItem
                tone="err"
                href="/waiter"
                title={t("attention.calls", { count: calls.length })}
                detail={calls
                  .slice(0, 3)
                  .map((call) => call.tableLabel)
                  .join(", ")}
              />
            )}
            {pendingApproval > 0 && (
              <AttentionItem
                tone="warn"
                href="/waiter"
                title={t("attention.pendingOrders", { count: pendingApproval })}
              />
            )}
            {criticalIngredients.length > 0 && (
              <AttentionItem
                tone="warn"
                href="/admin/ingredients"
                title={t("attention.criticalStock", { count: criticalIngredients.length })}
                detail={criticalIngredients
                  .slice(0, 3)
                  .map((ingredient) => ingredient.name)
                  .join(", ")}
              />
            )}
            {openTickets.length > 0 && (
              <AttentionItem
                tone="info"
                href="/admin/support"
                title={t("attention.openTickets", { count: openTickets.length })}
              />
            )}
            {reservations.length > 0 && (
              <AttentionItem
                tone="info"
                href="/admin/reservations"
                title={t("attention.upcomingReservations", { count: reservations.length })}
                detail={reservations
                  .slice(0, 2)
                  .map(
                    (reservation) =>
                      `${reservation.customerName} · ${new Intl.DateTimeFormat(locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: timezone,
                      }).format(new Date(reservation.reservedAt))}`,
                  )
                  .join(", ")}
              />
            )}

            {calls.length === 0 &&
              pendingApproval === 0 &&
              criticalIngredients.length === 0 &&
              openTickets.length === 0 &&
              reservations.length === 0 && <DashboardAllClear>{t("attention.allClear")}</DashboardAllClear>}
          </div>
        </DashboardSection>
      </div>

      {canViewRevenue && (
        <DashboardSection title={t("topProducts.title")} href={reportsHref} linkLabel={t("topProducts.allReports")}>
          <DashboardTopProducts rows={topProducts.slice(0, 5)} currency={currency} empty={t("topProducts.empty")} />
        </DashboardSection>
      )}

      {/* Etiketler sidebar'daki nav adlarının KOPYASI DEĞİL, eylem cümlesi
          ("Menüyü düzenle"). İki gerekçe: hızlı işlem ne yapacağını
          söylemeli, ve birebir aynı ad `getByRole("link", { name: "Menü" })`
          gibi mevcut E2E locator'larını iki öğeye düşürüp strict-mode
          ihlali üretiyordu (admin-nav.spec.ts'te ölçüldü). */}
      <DashboardSection title={t("quickLinks.title")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <QuickLink href="/admin/menu" label={t("quickLinks.menu")} hint={t("quickLinks.menuHint")} />
          <QuickLink href="/admin/tables" label={t("quickLinks.tables")} hint={t("quickLinks.tablesHint")} />
          <QuickLink href="/admin/staff" label={t("quickLinks.staff")} hint={t("quickLinks.staffHint")} />
          <QuickLink href="/admin/reports" label={t("quickLinks.reports")} hint={t("quickLinks.reportsHint")} />
          <QuickLink href="/admin/settings" label={t("quickLinks.settings")} hint={t("quickLinks.settingsHint")} />
        </div>
      </DashboardSection>
    </div>
  );
}
