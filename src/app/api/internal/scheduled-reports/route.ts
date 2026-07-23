import { NextResponse } from "next/server";

import { runDueReportSchedules } from "@/lib/reports/scheduledDigest";

/**
 * pg_net'in (trigger_scheduled_reports_digest, 0048) gecelik fire-and-forget
 * POST attığı internal route — kimliksiz (JWT yok, Postgres çağırıyor),
 * paylaşılan bir sırla korunur (RULES #6/#40 ile aynı gerekçe: webhook'lar da
 * imzasız hiçbir olayı işlemez).
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runDueReportSchedules();
  return NextResponse.json(result);
}
