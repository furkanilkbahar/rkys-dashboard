import { getLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { WaiterPanel } from "@/components/waiter/waiter-panel";
import { can } from "@/lib/auth/can";
import { getCurrentActor } from "@/lib/auth/session";
import { assertStaffRole } from "@/lib/auth/staffGuard";
import { getAdminTenantSettings } from "@/lib/data/adminSettings";
import { getAdminTables } from "@/lib/data/adminTables";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getCouriers, getCourierLocations, getDeliveryOrders } from "@/lib/data/courier";
import { getUpcomingReservations } from "@/lib/data/reservations";
import { getOrdersByStatus } from "@/lib/data/staffOrders";
import { isSubscriptionActive } from "@/lib/data/subscription";
import { getOccupiedTables } from "@/lib/data/tableSessions";
import { getOpenWaiterCalls } from "@/lib/data/waiterCalls";
import { isEnabled } from "@/lib/modules/isEnabled";

import { seatReservation } from "@/app/(admin)/admin/(dashboard)/reservations/actions";
import { moveTableSession } from "./actions";

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
  const courierModuleEnabled = await isEnabled(actor.tenantId, "courier");
  const reservationsModuleEnabled = await isEnabled(actor.tenantId, "reservations");
  const canMoveTable = await can(actor, "session.move");
  const [calls, pendingOrders, settings, deliveryOrders, couriers, courierLocations, upcomingReservations, occupiedTables, allTables] = await Promise.all([
    getOpenWaiterCalls(actor.tenantId, branchId, locale),
    getOrdersByStatus(actor.tenantId, branchId, ["pending"]),
    getAdminTenantSettings(actor.tenantId),
    courierModuleEnabled ? getDeliveryOrders(actor.tenantId, branchId) : Promise.resolve([]),
    courierModuleEnabled ? getCouriers(actor.tenantId) : Promise.resolve([]),
    courierModuleEnabled ? getCourierLocations(actor.tenantId) : Promise.resolve([]),
    reservationsModuleEnabled ? getUpcomingReservations(actor.tenantId, branchId) : Promise.resolve([]),
    canMoveTable ? getOccupiedTables(actor.tenantId, branchId) : Promise.resolve([]),
    canMoveTable ? getAdminTables(actor.tenantId, branchId) : Promise.resolve([]),
  ]);
  const occupiedTableIds = new Set(occupiedTables.map((o) => o.tableId));
  const freeTables = allTables.filter((table) => table.isActive && !occupiedTableIds.has(table.id));

  return (
    <WaiterPanel
      tenantId={actor.tenantId}
      branchId={branchId}
      initialCalls={calls}
      initialPendingOrders={pendingOrders}
      deliveryOrders={deliveryOrders}
      couriers={couriers}
      initialCourierLocations={courierLocations}
      currency={settings?.currency ?? "TRY"}
      upcomingReservations={upcomingReservations}
      seatReservation={seatReservation}
      occupiedTables={occupiedTables}
      freeTables={freeTables}
      moveTableSession={moveTableSession}
    />
  );
}
