import "server-only";

import { isIyzicoConfigured, iyzicoPaymentProvider } from "./iyzico";
import { mockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./provider";

export type { CheckoutSession, CreateCheckoutSessionParams, PaymentProvider, RefundParams, RefundResult, WebhookEvent } from "./provider";

const PROVIDERS: Record<string, PaymentProvider> = {
  mock: mockPaymentProvider,
  iyzico: iyzicoPaymentProvider,
};

/**
 * Varsayılan sağlayıcı: IYZICO_API_KEY/IYZICO_SECRET_KEY env'de varsa iyzico,
 * yoksa (kullanıcının henüz sandbox anahtarı yok — Faz 3 Adım 3 kararı) mock.
 * Webhook route handler'ı provider adını URL'den (`[provider]`) okuyup burada
 * arar; bilinmeyen bir ad 404'e düşer.
 */
export function getDefaultPaymentProvider(): PaymentProvider {
  return isIyzicoConfigured() ? iyzicoPaymentProvider : mockPaymentProvider;
}

export function getPaymentProviderByName(name: string): PaymentProvider | null {
  return PROVIDERS[name] ?? null;
}
