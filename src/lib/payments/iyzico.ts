import "server-only";

import { createHmac, randomBytes, randomUUID } from "crypto";

import type { CheckoutSession, CreateCheckoutSessionParams, PaymentProvider, RefundParams, RefundResult, WebhookEvent } from "./provider";

// NOT: kullanıcının henüz iyzico sandbox anahtarı yok (Faz 3 Adım 3 kararı).
// Bu adaptör iyzico'nun kamuya açık checkout form API deseni (IYZWSv2 HMAC-
// SHA256 auth header + /payment/iyzipos/checkoutform/initialize/auth/ecom)
// referans alınarak yazıldı ama gerçek sandbox'a karşı DOĞRULANMADI —
// anahtarlar sağlandığında ayrı bir oturumda uçtan uca test edilmesi
// gerekiyor. IYZICO_API_KEY/IYZICO_SECRET_KEY/IYZICO_BASE_URL env'de yoksa
// getPaymentProvider() (index.ts) bu adaptörü hiç seçmez, mock kullanılır.

const API_KEY = process.env.IYZICO_API_KEY;
const SECRET_KEY = process.env.IYZICO_SECRET_KEY;
const BASE_URL = process.env.IYZICO_BASE_URL ?? "https://sandbox-api.iyzipay.com";
const WEBHOOK_SECRET = process.env.IYZICO_WEBHOOK_SECRET;

export function isIyzicoConfigured(): boolean {
  return Boolean(API_KEY && SECRET_KEY);
}

function buildAuthHeader(uri: string, body: string): string {
  if (!API_KEY || !SECRET_KEY) {
    throw new Error("iyzico is not configured");
  }
  const randomKey = `${Date.now()}${randomBytes(8).toString("hex")}`;
  const signatureInput = randomKey + uri + body;
  const signature = createHmac("sha256", SECRET_KEY).update(signatureInput).digest("hex");
  const authorizationParams = [
    `apiKey=${API_KEY}`,
    `randomKey=${randomKey}`,
    `signature=${signature}`,
  ].join("&");
  return `IYZWSv2 ${Buffer.from(authorizationParams).toString("base64")}`;
}

export const iyzicoPaymentProvider: PaymentProvider = {
  name: "iyzico",

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession> {
    const providerRef = randomUUID();
    const uri = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
    const body = JSON.stringify({
      locale: "tr",
      conversationId: providerRef,
      price: (params.amountMinor / 100).toFixed(2),
      paidPrice: (params.amountMinor / 100).toFixed(2),
      currency: params.currency,
      basketId: params.tableSessionId,
      callbackUrl: params.returnUrl,
    });

    const response = await fetch(`${BASE_URL}${uri}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: buildAuthHeader(uri, body) },
      body,
    });

    if (!response.ok) {
      throw new Error(`iyzico checkout initialize failed: ${response.status}`);
    }

    const data = (await response.json()) as { paymentPageUrl?: string; token?: string; status?: string };
    if (data.status !== "success" || !data.paymentPageUrl) {
      throw new Error("iyzico checkout initialize returned an error status");
    }

    return { checkoutUrl: data.paymentPageUrl, providerRef: data.token ?? providerRef };
  },

  async verifyAndParseWebhook(rawBody: string, signatureHeader: string | null): Promise<WebhookEvent | null> {
    if (!WEBHOOK_SECRET || !signatureHeader) return null;

    const expected = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
    if (expected !== signatureHeader) return null;

    const payload = JSON.parse(rawBody) as { token?: string; status?: string; paymentConversationId?: string };
    const providerRef = payload.token ?? payload.paymentConversationId;
    if (!providerRef) return null;

    return payload.status === "SUCCESS"
      ? { type: "payment_succeeded", providerRef }
      : { type: "payment_failed", providerRef };
  },

  async refund(params: RefundParams): Promise<RefundResult> {
    const uri = "/payment/refund";
    const body = JSON.stringify({
      paymentTransactionId: params.providerRef,
      price: (params.amountMinor / 100).toFixed(2),
    });

    const response = await fetch(`${BASE_URL}${uri}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: buildAuthHeader(uri, body) },
      body,
    });

    if (!response.ok) {
      throw new Error(`iyzico refund failed: ${response.status}`);
    }

    const data = (await response.json()) as { paymentTransactionId?: string };
    return { refundRef: data.paymentTransactionId ?? params.providerRef };
  },
};
