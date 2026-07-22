import "server-only";

import { createHmac, randomBytes, randomUUID } from "crypto";

import type {
  CancelSubscriptionParams,
  CheckoutSession,
  CreateSubscriptionCheckoutParams,
  SubscriptionProvider,
  WebhookEvent,
} from "./provider";

// NOT: kullanıcının henüz iyzico sandbox anahtarı yok (Faz 4 Adım 3 kararı,
// lib/payments/iyzico.ts ile aynı durum). Bu adaptör iyzico'nun recurring/
// abonelik API ailesini (v2/subscription/... — checkout form API'sinden
// [lib/payments/iyzico.ts] farklı bir endpoint grubu) referans alarak
// yazıldı ama gerçek sandbox'a karşı DOĞRULANMADI. IYZICO_API_KEY/
// IYZICO_SECRET_KEY yoksa index.ts bu adaptörü hiç seçmez, mock kullanılır.

const API_KEY = process.env.IYZICO_API_KEY;
const SECRET_KEY = process.env.IYZICO_SECRET_KEY;
const BASE_URL = process.env.IYZICO_BASE_URL ?? "https://sandbox-api.iyzipay.com";
const WEBHOOK_SECRET = process.env.IYZICO_SUBSCRIPTION_WEBHOOK_SECRET;

export function isIyzicoSubscriptionConfigured(): boolean {
  return Boolean(API_KEY && SECRET_KEY);
}

function buildAuthHeader(uri: string, body: string): string {
  if (!API_KEY || !SECRET_KEY) {
    throw new Error("iyzico is not configured");
  }
  const randomKey = `${Date.now()}${randomBytes(8).toString("hex")}`;
  const signatureInput = randomKey + uri + body;
  const signature = createHmac("sha256", SECRET_KEY).update(signatureInput).digest("hex");
  const authorizationParams = [`apiKey=${API_KEY}`, `randomKey=${randomKey}`, `signature=${signature}`].join("&");
  return `IYZWSv2 ${Buffer.from(authorizationParams).toString("base64")}`;
}

export const iyzicoSubscriptionProvider: SubscriptionProvider = {
  name: "iyzico",

  async createSubscriptionCheckout(params: CreateSubscriptionCheckoutParams): Promise<CheckoutSession> {
    const providerRef = randomUUID();
    const uri = "/v2/subscription/checkoutform/initialize";
    const body = JSON.stringify({
      locale: "tr",
      conversationId: providerRef,
      pricingPlanReferenceCode: params.planId,
      subscriptionInitialStatus: "ACTIVE",
      callbackUrl: params.returnUrl,
    });

    const response = await fetch(`${BASE_URL}${uri}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: buildAuthHeader(uri, body) },
      body,
    });

    if (!response.ok) {
      throw new Error(`iyzico subscription checkout initialize failed: ${response.status}`);
    }

    const data = (await response.json()) as { token?: string; status?: string };
    if (data.status !== "success" || !data.token) {
      throw new Error("iyzico subscription checkout initialize returned an error status");
    }

    return {
      checkoutUrl: `https://sandbox-cpanel.iyzipay.com/subscription/checkoutform/${data.token}`,
      providerRef: data.token,
    };
  },

  async verifyAndParseWebhook(rawBody: string, signatureHeader: string | null): Promise<WebhookEvent | null> {
    if (!WEBHOOK_SECRET || !signatureHeader) return null;

    const expected = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
    if (expected !== signatureHeader) return null;

    const payload = JSON.parse(rawBody) as { subscriptionReferenceCode?: string; status?: string };
    const providerRef = payload.subscriptionReferenceCode;
    if (!providerRef) return null;

    return payload.status === "ACTIVE"
      ? { type: "subscription_activated", providerRef }
      : { type: "subscription_failed", providerRef };
  },

  async cancelSubscription(params: CancelSubscriptionParams): Promise<void> {
    const uri = `/v2/subscription/subscriptions/${params.providerRef}/cancel`;
    const response = await fetch(`${BASE_URL}${uri}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: buildAuthHeader(uri, "") },
    });

    if (!response.ok) {
      throw new Error(`iyzico subscription cancel failed: ${response.status}`);
    }
  },
};
