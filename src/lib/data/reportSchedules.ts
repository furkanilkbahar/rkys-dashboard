import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ReportSchedule = {
  id: string;
  branchId: string;
  frequency: "daily" | "weekly";
  recipientEmail: string;
  isActive: boolean;
  lastSentAt: string | null;
};

export async function getReportSchedules(tenantId: string): Promise<ReportSchedule[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("report_schedules")
    .select("id, branch_id, frequency, recipient_email, is_active, last_sent_at")
    .eq("tenant_id", tenantId)
    .order("created_at");

  return (data ?? []).map((r) => ({
    id: r.id,
    branchId: r.branch_id,
    frequency: r.frequency as "daily" | "weekly",
    recipientEmail: r.recipient_email,
    isActive: r.is_active,
    lastSentAt: r.last_sent_at,
  }));
}
