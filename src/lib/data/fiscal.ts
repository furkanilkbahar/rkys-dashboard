import "server-only";

import { createClient } from "@/lib/supabase/server";

export type FiscalDailySummary = { receiptCount: number; totalAmountMinor: number };

export async function getFiscalDailySummary(businessDate: string): Promise<FiscalDailySummary> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_fiscal_daily_summary", { p_business_date: businessDate });
  const row = data?.[0];
  return { receiptCount: row?.receipt_count ?? 0, totalAmountMinor: row?.total_amount_minor ?? 0 };
}
