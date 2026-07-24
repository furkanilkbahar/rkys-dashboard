import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAccountingSyncLog, getSyncableOrders } from "@/lib/data/accounting";
import { getAdminTenantSettings } from "@/lib/data/adminSettings";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

import { syncOrderToAccounting } from "./actions";
import { AccountingManager } from "./accounting-manager";

export default async function AdminAccountingPage() {
  const actor = await requireAdminActor();
  await assertModuleEnabled(actor.tenantId, "accounting_export");

  const [syncableOrders, syncLog, settings] = await Promise.all([
    getSyncableOrders(actor.tenantId),
    getAccountingSyncLog(actor.tenantId),
    getAdminTenantSettings(actor.tenantId),
  ]);

  return (
    <AccountingManager
      syncableOrders={syncableOrders}
      syncLog={syncLog}
      currency={settings?.currency ?? "TRY"}
      syncOrderToAccounting={syncOrderToAccounting}
    />
  );
}
