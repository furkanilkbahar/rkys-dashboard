import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";

import { getDefaultEmailProvider } from "@/lib/email";
import { createServiceRoleClient } from "@/lib/supabase/server";

import { ReportDigestPdf } from "./ReportDigestPdf";

export type ReportScheduleRow = {
  id: string;
  tenant_id: string;
  branch_id: string;
  frequency: "daily" | "weekly";
  recipient_email: string;
  is_active: boolean;
  last_sent_at: string | null;
};

// PDF'ler tenant'ın admin arayüzü için ayrı bir dil tercihi tutulmadığından
// (yalnızca müşteri menüsü için tenant_locales var) sabit "tr" ile üretilir —
// Faz 7+'ta bir "personel arayüzü dili" ayarı eklenirse buradan okunacak.
const DIGEST_LOCALE = "tr";

export function isDue(schedule: ReportScheduleRow, now: Date): boolean {
  if (!schedule.is_active) return false;
  if (!schedule.last_sent_at) return true;

  const lastSent = new Date(schedule.last_sent_at);
  const hoursSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
  return schedule.frequency === "daily" ? hoursSinceLastSent >= 20 : hoursSinceLastSent >= 24 * 6.5;
}

async function buildAndSendDigest(schedule: ReportScheduleRow): Promise<void> {
  const service = createServiceRoleClient();

  const [{ data: tenant }, { data: branch }] = await Promise.all([
    service.from("tenants").select("name, currency").eq("id", schedule.tenant_id).single(),
    service.from("branches").select("name").eq("id", schedule.branch_id).single(),
  ]);
  if (!tenant || !branch) return;

  const periodDays = schedule.frequency === "daily" ? 1 : 7;
  const { data: summaryRows } = await service
    .from("daily_sales_summary")
    .select("business_date, revenue_minor, order_count")
    .eq("tenant_id", schedule.tenant_id)
    .eq("branch_id", schedule.branch_id)
    .order("business_date", { ascending: false })
    .limit(periodDays);

  const t = await getTranslations({ locale: DIGEST_LOCALE, namespace: "admin" });

  const rows = summaryRows ?? [];
  const revenueMinor = rows.reduce((sum, r) => sum + r.revenue_minor, 0);
  const orderCount = rows.reduce((sum, r) => sum + r.order_count, 0);
  const periodLabel =
    rows.length === 0
      ? t(schedule.frequency === "daily" ? "reportSchedules.digest.noClosedDay" : "reportSchedules.digest.noClosedDayWeek")
      : rows.length === 1
        ? rows[0].business_date
        : `${rows[rows.length - 1].business_date} — ${rows[0].business_date}`;

  const pdfBuffer = await renderToBuffer(
    ReportDigestPdf({
      tenantName: tenant.name,
      branchName: branch.name,
      periodLabel,
      revenueMinor,
      orderCount,
      currency: tenant.currency,
      labels: { revenue: t("reports.revenue"), orderCount: t("analytics.orderCount") },
    }),
  );

  const provider = getDefaultEmailProvider();
  await provider.sendEmail({
    tenantId: schedule.tenant_id,
    to: schedule.recipient_email,
    subject: `${tenant.name} — ${periodLabel}`,
    text: t("reportSchedules.digest.emailBody", { branch: branch.name }),
    attachment: { filename: "rapor.pdf", content: pdfBuffer, contentType: "application/pdf" },
  });

  await service.from("report_schedules").update({ last_sent_at: new Date().toISOString() }).eq("id", schedule.id);
}

export async function runOneReportSchedule(scheduleId: string): Promise<{ ok: boolean }> {
  const service = createServiceRoleClient();
  const { data: schedule } = await service.from("report_schedules").select("*").eq("id", scheduleId).single();
  if (!schedule) return { ok: false };

  await buildAndSendDigest(schedule as ReportScheduleRow);
  return { ok: true };
}

export async function runDueReportSchedules(): Promise<{ processed: number }> {
  const service = createServiceRoleClient();
  const { data: schedules } = await service.from("report_schedules").select("*").eq("is_active", true);

  const now = new Date();
  let processed = 0;
  for (const schedule of (schedules ?? []) as ReportScheduleRow[]) {
    if (isDue(schedule, now)) {
      await buildAndSendDigest(schedule);
      processed++;
    }
  }
  return { processed };
}
