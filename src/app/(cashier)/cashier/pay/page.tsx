import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";

import { requireCashierActor } from "@/lib/auth/cashierGuard";
import { getAdminTipPresets } from "@/lib/data/adminSettings";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getActiveSessionBalances, getRecentPayments } from "@/lib/data/cashier";
import { getReasonCodeOptions } from "@/lib/data/reasonCodes";
import { getSessionOrders, type SessionOrder } from "@/lib/data/sessionOrders";
import { getCurrentTenant } from "@/lib/data/tenant";

import { recordComp, recordPayment, refundPayment } from "./actions";
import { PayScreen } from "./pay-screen";

export default async function CashierPayPage() {
  const actor = await requireCashierActor();
  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    notFound();
  }

  const locale = await getLocale();

  const [tenant, sessions, tipPresets, compReasons, refundReasons, recentPayments] = await Promise.all([
    getCurrentTenant(),
    getActiveSessionBalances(actor.tenantId, branchId),
    getAdminTipPresets(actor.tenantId),
    getReasonCodeOptions(actor.tenantId, "comp", locale),
    getReasonCodeOptions(actor.tenantId, "refund", locale),
    getRecentPayments(actor.tenantId, branchId),
  ]);

  const ordersBySession: Record<string, SessionOrder[]> = {};
  await Promise.all(
    sessions.map(async (s) => {
      ordersBySession[s.tableSessionId] = await getSessionOrders(s.tableSessionId);
    }),
  );

  return (
    <PayScreen
      currency={tenant?.currency ?? "TRY"}
      sessions={sessions}
      ordersBySession={ordersBySession}
      tipPresets={tipPresets.filter((p) => p.isActive)}
      compReasons={compReasons}
      refundReasons={refundReasons}
      recentPayments={recentPayments}
      recordPayment={recordPayment}
      recordComp={recordComp}
      refundPayment={refundPayment}
    />
  );
}
