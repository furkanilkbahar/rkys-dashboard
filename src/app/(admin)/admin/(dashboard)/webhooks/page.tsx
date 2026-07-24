import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminWebhooks, getWebhookDeliveries } from "@/lib/data/webhooks";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

import { createWebhook, toggleWebhook } from "./actions";
import { WebhooksManager } from "./webhooks-manager";

export default async function AdminWebhooksPage() {
  const actor = await requireAdminActor();
  await assertModuleEnabled(actor.tenantId, "api_access");

  const webhooks = await getAdminWebhooks(actor.tenantId);
  const deliveriesByWebhook = Object.fromEntries(
    await Promise.all(webhooks.map(async (w) => [w.id, await getWebhookDeliveries(actor.tenantId, w.id)] as const)),
  );

  return (
    <WebhooksManager webhooks={webhooks} deliveriesByWebhook={deliveriesByWebhook} createWebhook={createWebhook} toggleWebhook={toggleWebhook} />
  );
}
