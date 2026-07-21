import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "crypto";

import type { CheckoutSession, CreateCheckoutSessionParams, PaymentProvider, RefundParams, RefundResult, WebhookEvent } from "./provider";

// Yalnızca yerel geliştirme/test için — gerçek sağlayıcılarda (iyzico.ts)
// anahtar process.env'den okunur (RULES #4), burada gerçek bir gizli değer
// olmadığı (sağlayıcının kendisi de sahte) için kod içinde sabit.
const MOCK_WEBHOOK_SECRET = "mock-payment-webhook-secret-local-only";

export function signMockWebhookBody(rawBody: string): string {
  return createHmac("sha256", MOCK_WEBHOOK_SECRET).update(rawBody).digest("hex");
}

export const mockPaymentProvider: PaymentProvider = {
  name: "mock",

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession> {
    const providerRef = randomUUID();
    const checkoutUrl = `/masa/pay/mock/${providerRef}?amount=${params.amountMinor}&currency=${params.currency}&return=${encodeURIComponent(params.returnUrl)}`;
    return { checkoutUrl, providerRef };
  },

  async verifyAndParseWebhook(rawBody: string, signatureHeader: string | null): Promise<WebhookEvent | null> {
    if (!signatureHeader) return null;

    const expected = signMockWebhookBody(rawBody);
    const expectedBuf = Buffer.from(expected, "hex");
    const receivedBuf = Buffer.from(signatureHeader, "hex");
    if (expectedBuf.length !== receivedBuf.length || !timingSafeEqual(expectedBuf, receivedBuf)) {
      return null;
    }

    const payload = JSON.parse(rawBody) as { providerRef: string; status: string };
    return payload.status === "succeeded"
      ? { type: "payment_succeeded", providerRef: payload.providerRef }
      : { type: "payment_failed", providerRef: payload.providerRef };
  },

  async refund(params: RefundParams): Promise<RefundResult> {
    return { refundRef: `mock-refund-${params.providerRef}` };
  },
};
