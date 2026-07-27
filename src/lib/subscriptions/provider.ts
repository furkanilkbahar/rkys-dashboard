// Sağlayıcı-agnostik abonelik arayüzü — lib/payments/provider.ts'in (Faz 3
// Adım 3) birebir aynı deseni: yalnızca iyzico değil, ileride başka bir
// abonelik sağlayıcısı da bu arayüze karşı yeni bir adaptör olarak eklenebilir.

export type CreateSubscriptionCheckoutParams = {
  tenantId: string;
  planId: string;
  returnUrl: string;
  /**
   * Yalnızca mock sağlayıcı kullanır — sahte checkout sayfasının hangi
   * yol altında sunulacağını belirtir. Billing akışı (tenant alt-domaini,
   * session var) varsayılanı kullanır; kayıt akışı (kök domain, henüz
   * session yok, tenant'ın alt-domaini onaydan önce proxy tarafından
   * tamamen kapalı) kendi kök-domain yolunu geçer. iyzico adaptörü kendi
   * barındırdığı checkout URL'ini döndürdüğü için bu alanı yok sayar.
   */
  checkoutBasePath?: string;
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
