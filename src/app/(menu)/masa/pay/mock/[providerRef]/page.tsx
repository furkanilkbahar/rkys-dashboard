import { MockCheckout } from "./mock-checkout";

export default async function MockPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ providerRef: string }>;
  searchParams: Promise<{ amount?: string; currency?: string; return?: string }>;
}) {
  const { providerRef } = await params;
  const { amount, currency, return: returnUrl } = await searchParams;

  return (
    <MockCheckout
      providerRef={providerRef}
      amountMinor={parseInt(amount ?? "0", 10)}
      currency={currency ?? "TRY"}
      returnUrl={returnUrl ?? "/masa"}
    />
  );
}
