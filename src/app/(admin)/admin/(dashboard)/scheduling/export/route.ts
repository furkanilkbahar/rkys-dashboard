import { NextResponse } from "next/server";

import { assertCan, PermissionDeniedError } from "@/lib/auth/can";
import { getCurrentActor } from "@/lib/auth/session";
import { getAdminTenantSettings } from "@/lib/data/adminSettings";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getHoursWorked } from "@/lib/data/scheduling";
import { isEnabled } from "@/lib/modules/isEnabled";
import { toCsv } from "@/lib/reports/csv";
import { addDaysToIsoDate, todayIsoInTimezone, zonedWallTimeToUtcIso } from "@/lib/utils/timezone";

// Varsayılan dönem: son 14 gün (Faz 11 kapsamında dönem seçimi UI'da yok,
// gerekirse ileride searchParams ile genişletilir — period-reports export
// deseniyle aynı basit route handler yapısı). Aralık, sunucunun UTC gününe
// göre değil TENANT saat dilimine göre hesaplanır (reports/page.tsx todayIso
// ile aynı gerekçe — aksi halde gece yarısına yakın ~saatlerde yanlış gün
// dışa aktarılır).
export async function GET() {
  const actor = await getCurrentActor();
  if (!actor) {
    return NextResponse.json({ error: "forbidden" }, { status: 401 });
  }
  try {
    await assertCan(actor, "staff.manage");
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw err;
  }
  if (!(await isEnabled(actor.tenantId, "staff_scheduling"))) {
    return NextResponse.json({ error: "not_enabled" }, { status: 403 });
  }

  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const settings = await getAdminTenantSettings(actor.tenantId);
  const timezone = settings?.timezone ?? "UTC";
  const todayIso = todayIsoInTimezone(timezone);
  const from = zonedWallTimeToUtcIso(`${addDaysToIsoDate(todayIso, -13)}T00:00`, timezone);
  const to = zonedWallTimeToUtcIso(`${addDaysToIsoDate(todayIso, 1)}T00:00`, timezone);

  const rows = await getHoursWorked(actor.tenantId, branchId, from, to);
  const csv = toCsv(
    ["Personel", "Toplam Dakika", "Toplam Saat"],
    rows.map((r) => [r.badgeNo ?? r.profileId, r.totalMinutes, (r.totalMinutes / 60).toFixed(2)]),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="puantaj-${todayIso}.csv"`,
    },
  });
}
