import { notFound } from "next/navigation";

import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminTables } from "@/lib/data/adminTables";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getAdminReservations, getAdminWaitlist } from "@/lib/data/reservations";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

import {
  addToWaitlist,
  callFromWaitlist,
  cancelReservation,
  cancelWaitlistEntry,
  confirmReservation,
  createReservation,
  markReservationNoShow,
  seatFromWaitlist,
  seatReservation,
} from "./actions";
import { ReservationsManager } from "./reservations-manager";

export default async function AdminReservationsPage() {
  const actor = await requireAdminActor();
  await assertModuleEnabled(actor.tenantId, "reservations");
  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    notFound();
  }

  const [reservations, waitlist, tables] = await Promise.all([
    getAdminReservations(actor.tenantId, branchId),
    getAdminWaitlist(actor.tenantId, branchId),
    getAdminTables(actor.tenantId, branchId),
  ]);

  return (
    <ReservationsManager
      branchId={branchId}
      reservations={reservations}
      waitlist={waitlist}
      tables={tables}
      actions={{
        createReservation,
        confirmReservation,
        seatReservation,
        cancelReservation,
        markReservationNoShow,
        addToWaitlist,
        callFromWaitlist,
        seatFromWaitlist,
        cancelWaitlistEntry,
      }}
    />
  );
}
