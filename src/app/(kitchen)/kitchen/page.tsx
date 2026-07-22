import { notFound, redirect } from "next/navigation";

import { KdsPanel } from "@/components/kitchen/kds-panel";
import { getCurrentActor } from "@/lib/auth/session";
import { assertStaffRole } from "@/lib/auth/staffGuard";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getOrdersByStatus } from "@/lib/data/staffOrders";
import { isSubscriptionActive } from "@/lib/data/subscription";

export default async function KitchenHomePage() {
  const actor = await getCurrentActor();
  if (!actor) {
    redirect("/admin/login");
  }
  // Faz 4 Adım 3 (S13): admin panelle aynı kısıtlama, bkz. (dashboard)/layout.tsx.
  if (!(await isSubscriptionActive(actor.tenantId))) {
    redirect("/admin/billing");
  }
  assertStaffRole(actor, ["owner", "manager", "kitchen"]);

  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    notFound();
  }

  const orders = await getOrdersByStatus(actor.tenantId, branchId, ["approved", "preparing", "ready"]);

  return <KdsPanel tenantId={actor.tenantId} branchId={branchId} initialOrders={orders} />;
}
