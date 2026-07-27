import { getPendingModuleRequests } from "@/lib/data/platformTenants";

import { resolveModuleRequest } from "./actions";
import { ModuleRequestsManager } from "./module-requests-manager";

export default async function PlatformModuleRequestsPage() {
  const requests = await getPendingModuleRequests();

  return <ModuleRequestsManager requests={requests} resolveModuleRequest={resolveModuleRequest} />;
}
