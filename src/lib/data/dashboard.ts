import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Faz 23 Adım 2 — Pano'nun ihtiyaç duyduğu ve başka hiçbir yerde olmayan tek
 * sorgu: ciro trendi.
 *
 * Panonun geri kalanı BİLEREK yeni sorgu yazmıyor; mevcut veri katmanını
 * yeniden kullanıyor (`getRevenueReport`, `getOccupiedTables`,
 * `getOrdersByStatus`, `getOpenWaiterCalls`, `getAdminIngredients`,
 * `getUpcomingReservations`, `getAdminSupportTickets`, `getTopProducts`).
 * Aynı veriyi ikinci bir sorguyla çekmek, iki yerin zamanla farklı cevap
 * vermesi demek olurdu.
 */
export type RevenueTrendPoint = {
  businessDate: string;
  revenueMinor: number;
  orderCount: number;
};

/**
 * Kapanmış günlerin ciro serisi (en eskiden yeniye).
 *
 * `daily_sales_summary`'ye YALNIZCA kapatılmış günler girer (0044) — yani bu
 * seri bugünü içermez ve içermemeli: yarım bir günü tamamlanmış günlerle aynı
 * çizgide göstermek, işletmeciye "bugün düşük" yanılgısı verirdi. Bugünün
 * rakamı panoda ayrı bir kart olarak, canlı `get_revenue_report`'tan gelir.
 *
 * Hiç kapanmış gün yoksa boş dizi döner ve çağıran taraf sparkline'ı HİÇ
 * çizmez — eksik veri sıfırla doldurulmaz.
 */
export async function getRevenueTrend(branchId: string, days = 14): Promise<RevenueTrendPoint[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_sales_summary")
    .select("business_date, revenue_minor, order_count")
    .eq("branch_id", branchId)
    .order("business_date", { ascending: false })
    .limit(days);

  return (data ?? [])
    .map((row) => ({
      businessDate: row.business_date,
      revenueMinor: row.revenue_minor,
      orderCount: row.order_count,
    }))
    .reverse();
}

/**
 * Bugünün sipariş sayısı — iptaller hariç, tenant saat dilimine göre.
 *
 * NEDEN `get_period_revenue_report` KULLANILMADI: o RPC yalnızca
 * `daily_sales_summary`yi okur, oraya da yalnızca KAPATILMIŞ günler girer —
 * yani bugün için her zaman 0 dönerdi. Panoda "bugün 0 sipariş" yazması,
 * kasada sipariş varken açık bir yalan olurdu.
 *
 * NEDEN YENİ BİR RPC/MIGRATION AÇILMADI: gün sınırı SQL'de
 * `(created_at at time zone tz)::date` ile hesaplanıyor (0044 backfill'i);
 * aynı hesabı TS tarafında yapmak için son 48 saat çekilip her satırın tarihi
 * tenant saat diliminde biçimlendiriliyor. Fazladan çekilen bir gün önemsiz
 * (tek şubenin günlük sipariş sayısı), buna karşılık yaz saati geçişlerinde
 * elle ofset aritmetiğinin ürettiği kaymalardan tamamen kaçınılıyor.
 */
export async function getTodayOrderCount(branchId: string, timezone: string, todayIso: string): Promise<number> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("orders")
    .select("created_at")
    .eq("branch_id", branchId)
    .neq("status", "cancelled")
    .gte("created_at", since);

  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
  return (data ?? []).filter((row) => formatter.format(new Date(row.created_at)) === todayIso).length;
}
