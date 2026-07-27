import { notFound } from "next/navigation";

import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminStaff } from "@/lib/data/adminStaff";
import { getAdminTenantSettings } from "@/lib/data/adminSettings";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getHoursWorked, getStaffPerformance, getStaffShifts } from "@/lib/data/scheduling";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";
import { addDaysToIsoDate, todayIsoInTimezone, zonedWallTimeToUtcIso } from "@/lib/utils/timezone";

import { createShift, deleteShift, setStaffPerformanceGoal } from "./actions";
import { SchedulingManager } from "./scheduling-manager";

export default async function AdminSchedulingPage() {
  const actor = await requireAdminActor();
  await assertModuleEnabled(actor.tenantId, "staff_scheduling");
  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    notFound();
  }

  // "Bugün" tenant saat dilimine göre hesaplanır — sunucunun UTC gününe
  // güvenmek, tenant Istanbul gibi UTC+3 bir dilimdeyken gece yarısına yakın
  // ~3 saatlik pencerede yanlış haftayı/dönemi gösterir (RULES: business
  // date hep tenant saat dilimiyle, bkz. reports/page.tsx todayIso).
  const settings = await getAdminTenantSettings(actor.tenantId);
  const timezone = settings?.timezone ?? "UTC";
  const todayIso = todayIsoInTimezone(timezone);
  const weekFrom = addDaysToIsoDate(todayIso, -3);
  const weekTo = addDaysToIsoDate(todayIso, 10);
  const reportFrom = zonedWallTimeToUtcIso(`${addDaysToIsoDate(todayIso, -13)}T00:00`, timezone);
  const reportTo = zonedWallTimeToUtcIso(`${addDaysToIsoDate(todayIso, 1)}T00:00`, timezone);

  const [staff, shifts, hoursWorked, staffPerformance] = await Promise.all([
    getAdminStaff(actor.tenantId),
    getStaffShifts(actor.tenantId, branchId, weekFrom, weekTo),
    getHoursWorked(actor.tenantId, branchId, reportFrom, reportTo),
    getStaffPerformance(actor.tenantId, branchId, reportFrom, reportTo),
  ]);

  return (
    <SchedulingManager
      staff={staff}
      shifts={shifts}
      hoursWorked={hoursWorked}
      staffPerformance={staffPerformance}
      createShift={createShift}
      deleteShift={deleteShift}
      setStaffPerformanceGoal={setStaffPerformanceGoal}
    />
  );
}
