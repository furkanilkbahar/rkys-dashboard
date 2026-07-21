import { notFound } from "next/navigation";

import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getAdminGenericQrCodes, getAdminTables, getAdminZones } from "@/lib/data/adminTables";

import {
  createGenericQr,
  createTable,
  createZone,
  regenerateGenericQr,
  regenerateTableQr,
} from "./actions";
import { TablesManager } from "./tables-manager";

export default async function AdminTablesPage() {
  const actor = await requireAdminActor();
  const branchId = await getDefaultBranchId(actor.tenantId);

  if (!branchId) {
    notFound();
  }

  const [zones, tables, genericQrCodes] = await Promise.all([
    getAdminZones(actor.tenantId, branchId),
    getAdminTables(actor.tenantId, branchId),
    getAdminGenericQrCodes(actor.tenantId, branchId),
  ]);

  return (
    <TablesManager
      branchId={branchId}
      zones={zones}
      tables={tables}
      genericQrCodes={genericQrCodes}
      actions={{ createZone, createTable, regenerateTableQr, createGenericQr, regenerateGenericQr }}
    />
  );
}
