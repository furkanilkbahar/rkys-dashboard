import { getPendingTenants } from "@/lib/data/platformTenants";

import { approveTenant, rejectTenant } from "./actions";
import { PendingTenantsManager } from "./pending-tenants-manager";

export default async function PlatformPendingTenantsPage() {
  const tenants = await getPendingTenants();

  return <PendingTenantsManager tenants={tenants} approveTenant={approveTenant} rejectTenant={rejectTenant} />;
}
