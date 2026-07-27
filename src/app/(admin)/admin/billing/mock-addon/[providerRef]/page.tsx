import { getTranslations } from "next-intl/server";

import { MockSubscriptionCheckout } from "@/components/subscriptions/mock-subscription-checkout";

export default async function MockAddonCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ providerRef: string }>;
  searchParams: Promise<{ plan?: string; return?: string }>;
}) {
  const { providerRef } = await params;
  const { plan: moduleKey, return: returnUrl } = await searchParams;
  const t = await getTranslations("admin.settings.modules.keys");

  const moduleName = moduleKey ? t(moduleKey) : "";

  return <MockSubscriptionCheckout providerRef={providerRef} planName={moduleName} returnUrl={returnUrl ?? "/admin/settings"} />;
}
