// Sağlayıcı-agnostik online ödeme arayüzü — yalnızca iyzico değil, ileride
// banka POS / başka online ödeme sağlayıcıları da bu arayüze karşı yeni bir
// adaptör (mock.ts/iyzico.ts örneği) olarak eklenebilir (kullanıcı kararı,
// Faz 3 Adım 3 planlaması). lib/integrations/{delivery|accounting|...}
// adaptör mimarisiyle aynı desen (ARCHITECTURE.md #4).

export type CreateCheckoutSessionParams = {
  tableSessionId: string;
  amountMinor: number;
  currency: string;
  returnUrl: string;
};

export type CheckoutSession = {
  checkoutUrl: string;
  providerRef: string;
};

export type WebhookEvent =
  | { type: "payment_succeeded"; providerRef: string }
  | { type: "payment_failed"; providerRef: string };

export type RefundParams = {
  providerRef: string;
  amountMinor: number;
};

export type RefundResult = {
  refundRef: string;
};

export interface PaymentProvider {
  readonly name: string;
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession>;
  /** İmza geçersizse null döner — çağıran taraf bunu 401 olarak işler (RULES #6). */
  verifyAndParseWebhook(rawBody: string, signatureHeader: string | null): Promise<WebhookEvent | null>;
  refund(params: RefundParams): Promise<RefundResult>;
}
