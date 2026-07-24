import { notFound } from "next/navigation";

import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminStaff } from "@/lib/data/adminStaff";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getHoursWorked, getStaffShifts } from "@/lib/data/scheduling";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

import { createShift, deleteShift } from "./actions";
import { SchedulingManager } from "./scheduling-manager";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function AdminSchedulingPage() {
  const actor = await requireAdminActor();
  await assertModuleEnabled(actor.tenantId, "staff_scheduling");
  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    notFound();
  }

  const today = new Date();
  const weekFrom = isoDate(new Date(today.getTime() - 3 * 86_400_000));
  const weekTo = isoDate(new Date(today.getTime() + 10 * 86_400_000));
  const reportFrom = new Date(today.getTime() - 13 * 86_400_000).toISOString();
  const reportTo = new Date(today.getTime() + 86_400_000).toISOString();

  const [staff, shifts, hoursWorked] = await Promise.all([
    getAdminStaff(actor.tenantId),
    getStaffShifts(actor.tenantId, branchId, weekFrom, weekTo),
    getHoursWorked(actor.tenantId, branchId, reportFrom, reportTo),
  ]);

  return (
    <SchedulingManager
      staff={staff}
      shifts={shifts}
      hoursWorked={hoursWorked}
      createShift={createShift}
      deleteShift={deleteShift}
    />
  );
}
