import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminApiKeys } from "@/lib/data/apiKeys";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

import { createApiKey, revokeApiKey } from "./actions";
import { ApiKeysManager } from "./api-keys-manager";

export default async function AdminApiKeysPage() {
  const actor = await requireAdminActor();
  await assertModuleEnabled(actor.tenantId, "api_access");

  const keys = await getAdminApiKeys(actor.tenantId);

  return <ApiKeysManager keys={keys} createKey={createApiKey} revokeKey={revokeApiKey} />;
}
