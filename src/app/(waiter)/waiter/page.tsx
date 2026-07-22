import { getLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { WaiterPanel } from "@/components/waiter/waiter-panel";
import { getCurrentActor } from "@/lib/auth/session";
import { assertStaffRole } from "@/lib/auth/staffGuard";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getOrdersByStatus } from "@/lib/data/staffOrders";
import { isSubscriptionActive } from "@/lib/data/subscription";
import { getOpenWaiterCalls } from "@/lib/data/waiterCalls";

export default async function WaiterHomePage() {
  const actor = await getCurrentActor();
  if (!actor) {
    redirect("/admin/login");
  }
  // Faz 4 Adım 3 (S13): admin panelle aynı kısıtlama, bkz. (dashboard)/layout.tsx.
  if (!(await isSubscriptionActive(actor.tenantId))) {
    redirect("/admin/billing");
  }
  assertStaffRole(actor, ["owner", "manager", "waiter"]);

  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    notFound();
  }

  const locale = await getLocale();
  const [calls, pendingOrders] = await Promise.all([
    getOpenWaiterCalls(actor.tenantId, branchId, locale),
    getOrdersByStatus(actor.tenantId, branchId, ["pending"]),
  ]);

  return (
    <WaiterPanel
      tenantId={actor.tenantId}
      branchId={branchId}
      initialCalls={calls}
      initialPendingOrders={pendingOrders}
    />
  );
}
