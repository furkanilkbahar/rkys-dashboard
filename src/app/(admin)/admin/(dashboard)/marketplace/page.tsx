import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminMarketplaceMappings, getSelectableProducts } from "@/lib/data/marketplace";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

import { createMapping, deleteMapping } from "./actions";
import { MarketplaceManager } from "./marketplace-manager";

export default async function AdminMarketplacePage() {
  const actor = await requireAdminActor();
  await assertModuleEnabled(actor.tenantId, "marketplace");

  const [mappings, products] = await Promise.all([
    getAdminMarketplaceMappings(actor.tenantId),
    getSelectableProducts(actor.tenantId),
  ]);

  return <MarketplaceManager mappings={mappings} products={products} createMapping={createMapping} deleteMapping={deleteMapping} />;
}
