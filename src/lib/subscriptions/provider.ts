// Sağlayıcı-agnostik abonelik arayüzü — lib/payments/provider.ts'in (Faz 3
// Adım 3) birebir aynı deseni: yalnızca iyzico değil, ileride başka bir
// abonelik sağlayıcısı da bu arayüze karşı yeni bir adaptör olarak eklenebilir.

export type CreateSubscriptionCheckoutParams = {
  tenantId: string;
  planId: string;
  returnUrl: string;
};

export type CheckoutSession = {
  checkoutUrl: string;
  providerRef: string;
};

export type WebhookEvent =
  | { type: "subscription_activated"; providerRef: string }
  | { type: "subscription_failed"; providerRef: string };

export type CancelSubscriptionParams = {
  providerRef: string;
};

export interface SubscriptionProvider {
  readonly name: string;
  createSubscriptionCheckout(params: CreateSubscriptionCheckoutParams): Promise<CheckoutSession>;
  /** İmza geçersizse null döner — çağıran taraf bunu 401 olarak işler (RULES #6). */
  verifyAndParseWebhook(rawBody: string, signatureHeader: string | null): Promise<WebhookEvent | null>;
  cancelSubscription(params: CancelSubscriptionParams): Promise<void>;
}
