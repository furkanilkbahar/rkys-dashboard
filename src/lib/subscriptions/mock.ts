import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "crypto";

import type { CheckoutSession, CreateSubscriptionCheckoutParams, SubscriptionProvider, WebhookEvent } from "./provider";

// Yalnızca yerel geliştirme/test için — lib/payments/mock.ts'deki gerekçeyle
// aynı: sağlayıcının kendisi de sahte olduğu için gerçek bir gizli değer yok.
const MOCK_SUBSCRIPTION_WEBHOOK_SECRET = "mock-subscription-webhook-secret-local-only";

export function signMockSubscriptionWebhookBody(rawBody: string): string {
  return createHmac("sha256", MOCK_SUBSCRIPTION_WEBHOOK_SECRET).update(rawBody).digest("hex");
}

export const mockSubscriptionProvider: SubscriptionProvider = {
  name: "mock",

  async createSubscriptionCheckout(params: CreateSubscriptionCheckoutParams): Promise<CheckoutSession> {
    const providerRef = randomUUID();
    const basePath = params.checkoutBasePath ?? "/admin/billing/mock";
    const checkoutUrl = `${basePath}/${providerRef}?plan=${params.planId}&return=${encodeURIComponent(params.returnUrl)}`;
    return { checkoutUrl, providerRef };
  },

  async verifyAndParseWebhook(rawBody: string, signatureHeader: string | null): Promise<WebhookEvent | null> {
    if (!signatureHeader) return null;

    const expected = signMockSubscriptionWebhookBody(rawBody);
    const expectedBuf = Buffer.from(expected, "hex");
    const receivedBuf = Buffer.from(signatureHeader, "hex");
    if (expectedBuf.length !== receivedBuf.length || !timingSafeEqual(expectedBuf, receivedBuf)) {
      return null;
    }

    const payload = JSON.parse(rawBody) as { providerRef: string; status: string };
    return payload.status === "succeeded"
      ? { type: "subscription_activated", providerRef: payload.providerRef }
      : { type: "subscription_failed", providerRef: payload.providerRef };
  },

  async cancelSubscription(): Promise<void> {
    // mock sağlayıcıda ayrı bir API çağrısı yok — abonelik iptali doğrudan
    // cancel_subscription RPC'siyle (DB) yapılır.
  },
};
