import { MockSubscriptionCheckout } from "@/components/subscriptions/mock-subscription-checkout";
import { getPlans } from "@/lib/data/plans";

export default async function RegistrationMockCheckoutPage({
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

  return <MockSubscriptionCheckout providerRef={providerRef} planName={plan?.name ?? ""} returnUrl={returnUrl ?? "/kayit/tamamlandi"} />;
}
