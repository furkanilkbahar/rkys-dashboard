import { notFound } from "next/navigation";

import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getAdminKioskDevices } from "@/lib/data/kiosk";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

import { createKioskDevice, toggleKioskDevice } from "./actions";
import { KioskManager } from "./kiosk-manager";

export default async function AdminKioskPage() {
  const actor = await requireAdminActor();
  await assertModuleEnabled(actor.tenantId, "kiosk");
  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    notFound();
  }

  const devices = await getAdminKioskDevices(actor.tenantId, branchId);

  return <KioskManager devices={devices} createKioskDevice={createKioskDevice} toggleKioskDevice={toggleKioskDevice} />;
}
