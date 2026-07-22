import { getPlans } from "@/lib/data/plans";

import { MockSubscriptionCheckout } from "./mock-checkout";

export default async function MockSubscriptionCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ providerRef: string }>;
  searchParams: Promise<{ plan?: string; return?: string }>;
}) {
  const { providerRef } = await params;
  const { plan: planId, return: returnUrl } = await searchParams;

  const plans = await getPlans();
  const plan = plans.find((p) => p.id === planId);

  return (
    <MockSubscriptionCheckout
      providerRef={providerRef}
      planName={plan?.name ?? ""}
      returnUrl={returnUrl ?? "/admin/billing"}
    />
  );
}
