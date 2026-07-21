import { NextResponse } from "next/server";

import { can } from "@/lib/auth/can";
import { getCurrentActor } from "@/lib/auth/session";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getMarginReport, getRevenueReport, getTopProducts } from "@/lib/data/reports";
import { toCsv } from "@/lib/reports/csv";
import { formatPrice } from "@/lib/utils/currency";
import { createClient } from "@/lib/supabase/server";

const REPORT_TYPES = ["revenue", "topProducts", "margin"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

export async function GET(request: Request) {
  const actor = await getCurrentActor();
  if (!actor) {
    return NextResponse.json({ error: "forbidden" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as ReportType | null;
  const businessDate = searchParams.get("date");
  if (!type || !REPORT_TYPES.includes(type) || !businessDate) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const permissionKey = type === "margin" ? "reports.profit" : "reports.revenue";
  if (!(await can(actor, permissionKey))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: tenant } = await supabase.from("tenants").select("currency").eq("id", actor.tenantId).single();
  const currency = tenant?.currency ?? "TRY";

  let csv: string;
  let filename: string;

  if (type === "revenue") {
    const report = await getRevenueReport(branchId, businessDate);
    csv = toCsv(
      ["Kalem", "Tutar"],
      report
        ? [
            ["Ciro", formatPrice(report.revenueMinor, currency)],
            ["Nakit", formatPrice(report.cashMinor, currency)],
            ["Kart (Manuel)", formatPrice(report.cardManualMinor, currency)],
            ["Online", formatPrice(report.onlineMinor, currency)],
            ["Bahşiş", formatPrice(report.tipsMinor, currency)],
            ["İkram/İndirim", formatPrice(report.compsMinor, currency)],
            ["İade", formatPrice(report.refundsMinor, currency)],
          ]
        : [],
    );
    filename = `ciro-${businessDate}.csv`;
  } else if (type === "topProducts") {
    const rows = await getTopProducts(branchId, businessDate);
    csv = toCsv(
      ["Ürün", "Adet", "Ciro"],
      rows.map((r) => [r.productName, r.quantity, formatPrice(r.revenueMinor, currency)]),
    );
    filename = `en-cok-satanlar-${businessDate}.csv`;
  } else {
    const rows = await getMarginReport(branchId, businessDate);
    csv = toCsv(
      ["Ürün", "Adet", "Ciro", "Maliyet", "Marj"],
      rows.map((r) => [r.productName, r.quantity, formatPrice(r.revenueMinor, currency), formatPrice(r.costMinor, currency), formatPrice(r.marginMinor, currency)]),
    );
    filename = `kar-marji-${businessDate}.csv`;
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
