import "server-only";

import { isIyzicoSubscriptionConfigured, iyzicoSubscriptionProvider } from "./iyzico";
import { mockSubscriptionProvider } from "./mock";
import type { SubscriptionProvider } from "./provider";

export type {
  CancelSubscriptionParams,
  CheckoutSession,
  CreateSubscriptionCheckoutParams,
  SubscriptionProvider,
  WebhookEvent,
} from "./provider";

const PROVIDERS: Record<string, SubscriptionProvider> = {
  mock: mockSubscriptionProvider,
  iyzico: iyzicoSubscriptionProvider,
};

/**
 * Varsayılan sağlayıcı: IYZICO_API_KEY/IYZICO_SECRET_KEY env'de varsa iyzico,
 * yoksa (henüz sandbox anahtarı yok) mock. Webhook route handler'ı sağlayıcı
 * adını URL'den (`[provider]`) okuyup burada arar; bilinmeyen ad 404'e düşer.
 */
export function getDefaultSubscriptionProvider(): SubscriptionProvider {
  return isIyzicoSubscriptionConfigured() ? iyzicoSubscriptionProvider : mockSubscriptionProvider;
}

export function getSubscriptionProviderByName(name: string): SubscriptionProvider | null {
  return PROVIDERS[name] ?? null;
}
