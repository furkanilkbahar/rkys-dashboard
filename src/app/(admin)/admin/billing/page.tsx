import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getPlans } from "@/lib/data/plans";
import { getAdminSubscription } from "@/lib/data/subscription";

import { cancelSubscription, startSubscriptionCheckout } from "./actions";
import { BillingManager } from "./billing-manager";

export default async function AdminBillingPage() {
  const actor = await requireAdminActor();
  const [subscription, plans] = await Promise.all([getAdminSubscription(actor.tenantId), getPlans()]);

  return (
    <BillingManager
      isOwner={actor.role === "owner"}
      subscription={subscription}
      trialDaysLeft={subscription?.trialDaysLeft ?? null}
      plans={plans}
      startSubscriptionCheckout={startSubscriptionCheckout}
      cancelSubscription={cancelSubscription}
    />
  );
}
