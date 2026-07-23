import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminLoyaltyCustomers, getAdminLoyaltyProgram } from "@/lib/data/loyalty";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

import { updateLoyaltyProgram } from "./actions";
import { LoyaltyManager } from "./loyalty-manager";

export default async function AdminLoyaltyPage() {
  const actor = await requireAdminActor();
  await assertModuleEnabled(actor.tenantId, "crm_loyalty");

  const [program, customers] = await Promise.all([getAdminLoyaltyProgram(actor.tenantId), getAdminLoyaltyCustomers(actor.tenantId)]);

  return <LoyaltyManager program={program} customers={customers} updateLoyaltyProgram={updateLoyaltyProgram} />;
}
