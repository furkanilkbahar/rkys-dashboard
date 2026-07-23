import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminTenantSettings } from "@/lib/data/adminSettings";
import { getAdminGiftCards } from "@/lib/data/giftCards";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

import { issueGiftCard } from "./actions";
import { GiftCardsManager } from "./gift-cards-manager";

export default async function AdminGiftCardsPage() {
  const actor = await requireAdminActor();
  await assertModuleEnabled(actor.tenantId, "gift_cards");

  const [giftCards, settings] = await Promise.all([getAdminGiftCards(actor.tenantId), getAdminTenantSettings(actor.tenantId)]);

  return <GiftCardsManager giftCards={giftCards} currency={settings?.currency ?? "TRY"} issueGiftCard={issueGiftCard} />;
}
