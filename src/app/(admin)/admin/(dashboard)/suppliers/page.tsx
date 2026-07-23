import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminSuppliers } from "@/lib/data/suppliers";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

import { createSupplier } from "./actions";
import { SuppliersManager } from "./suppliers-manager";

export default async function AdminSuppliersPage() {
  const actor = await requireAdminActor();
  await assertModuleEnabled(actor.tenantId, "inventory");

  const suppliers = await getAdminSuppliers(actor.tenantId);

  return <SuppliersManager suppliers={suppliers} createSupplier={createSupplier} />;
}
