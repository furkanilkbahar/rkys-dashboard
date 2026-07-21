import { notFound } from "next/navigation";

import { requireCashierActor } from "@/lib/auth/cashierGuard";
import { getAdminTipPresets } from "@/lib/data/adminSettings";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getActiveSessionBalances } from "@/lib/data/cashier";
import { getCurrentTenant } from "@/lib/data/tenant";

import { recordPayment } from "./actions";
import { PayScreen } from "./pay-screen";

export default async function CashierPayPage() {
  const actor = await requireCashierActor();
  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    notFound();
  }

  const [tenant, sessions, tipPresets] = await Promise.all([
    getCurrentTenant(),
    getActiveSessionBalances(actor.tenantId, branchId),
    getAdminTipPresets(actor.tenantId),
  ]);

  return (
    <PayScreen
      currency={tenant?.currency ?? "TRY"}
      sessions={sessions}
      tipPresets={tipPresets.filter((p) => p.isActive)}
      recordPayment={recordPayment}
    />
  );
}
