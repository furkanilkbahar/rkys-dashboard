import { notFound } from "next/navigation";

import { requireCashierActor } from "@/lib/auth/cashierGuard";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getLastClosedShift, getOpenShift, getShiftMovements } from "@/lib/data/cashier";
import { getCurrentTenant } from "@/lib/data/tenant";

import { closeShift, openShift, recordCashMovement } from "./actions";
import { ShiftWidget } from "./shift-widget";

export default async function CashierHomePage() {
  const actor = await requireCashierActor();
  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    notFound();
  }

  const [tenant, openCashShift, lastClosedShift] = await Promise.all([
    getCurrentTenant(),
    getOpenShift(actor.tenantId, branchId),
    getLastClosedShift(actor.tenantId, branchId),
  ]);
  const movements = openCashShift ? await getShiftMovements(openCashShift.id) : [];

  return (
    <ShiftWidget
      branchId={branchId}
      currency={tenant?.currency ?? "TRY"}
      openShiftData={openCashShift}
      lastClosedShift={lastClosedShift}
      movements={movements}
      actions={{ openShift, closeShift, recordCashMovement }}
    />
  );
}
