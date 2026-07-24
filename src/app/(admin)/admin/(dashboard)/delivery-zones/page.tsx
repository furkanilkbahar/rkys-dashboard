import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminTenantSettings } from "@/lib/data/adminSettings";
import { getAdminDeliveryZones } from "@/lib/data/deliveryZones";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

import { createDeliveryZone, toggleDeliveryZone } from "./actions";
import { DeliveryZonesManager } from "./delivery-zones-manager";

export default async function AdminDeliveryZonesPage() {
  const actor = await requireAdminActor();
  await assertModuleEnabled(actor.tenantId, "delivery");

  const [zones, settings] = await Promise.all([getAdminDeliveryZones(actor.tenantId), getAdminTenantSettings(actor.tenantId)]);

  return (
    <DeliveryZonesManager zones={zones} currency={settings?.currency ?? "TRY"} createZone={createDeliveryZone} toggleZone={toggleDeliveryZone} />
  );
}
