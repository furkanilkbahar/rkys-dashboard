import { notFound } from "next/navigation";

import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminStaff, getRolePermissionMatrix, getStaffDevices } from "@/lib/data/adminStaff";
import { getDefaultBranchId } from "@/lib/data/branch";

import {
  createStaffDevice,
  resetStaffPin,
  revokeStaffDevice,
  updateRolePermission,
  updateStaffMember,
} from "./actions";
import { StaffManager } from "./staff-manager";

export default async function AdminStaffPage() {
  const actor = await requireAdminActor();
  const branchId = await getDefaultBranchId(actor.tenantId);

  if (!branchId) {
    notFound();
  }

  const [staff, devices, matrix] = await Promise.all([
    getAdminStaff(actor.tenantId),
    getStaffDevices(actor.tenantId, branchId),
    getRolePermissionMatrix(actor.tenantId),
  ]);

  return (
    <StaffManager
      branchId={branchId}
      staff={staff}
      devices={devices}
      matrix={matrix}
      actions={{ updateStaffMember, resetStaffPin, createStaffDevice, revokeStaffDevice, updateRolePermission }}
    />
  );
}
