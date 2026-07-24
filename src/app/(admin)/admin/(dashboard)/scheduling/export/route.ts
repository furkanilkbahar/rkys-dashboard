import { NextResponse } from "next/server";

import { getCurrentActor } from "@/lib/auth/session";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getHoursWorked } from "@/lib/data/scheduling";
import { toCsv } from "@/lib/reports/csv";

// Varsayılan dönem: son 14 gün (Faz 11 kapsamında dönem seçimi UI'da yok,
// gerekirse ileride searchParams ile genişletilir — period-reports export
// deseniyle aynı basit route handler yapısı).
export async function GET() {
  const actor = await getCurrentActor();
  if (!actor) {
    return NextResponse.json({ error: "forbidden" }, { status: 401 });
  }

  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const today = new Date();
  const from = new Date(today.getTime() - 13 * 86_400_000).toISOString();
  const to = new Date(today.getTime() + 86_400_000).toISOString();

  const rows = await getHoursWorked(actor.tenantId, branchId, from, to);
  const csv = toCsv(
    ["Personel", "Toplam Dakika", "Toplam Saat"],
    rows.map((r) => [r.badgeNo ?? r.profileId, r.totalMinutes, (r.totalMinutes / 60).toFixed(2)]),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="puantaj-${today.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
