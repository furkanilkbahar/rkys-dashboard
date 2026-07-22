"use server";

import { headers } from "next/headers";

import { signMockSubscriptionWebhookBody } from "@/lib/subscriptions/mock";

export async function confirmMockSubscriptionPayment(providerRef: string): Promise<{ ok: boolean }> {
  const headerStore = await headers();
  const origin = `${headerStore.get("x-forwarded-proto") ?? "http"}://${headerStore.get("host")}`;

  // Gerçek sağlayıcının sunucusu ne yapardıysa aynısı: imzalı bir webhook
  // POST'u — bu, verifyAndParseWebhook'un (RULES #6) gerçekten çalıştığını
  // uçtan uca kanıtlar, yalnızca RPC'yi doğrudan çağırmak değil (masa/pay/mock
  // ile aynı desen).
  const body = JSON.stringify({ providerRef, status: "succeeded" });
  const response = await fetch(`${origin}/api/webhooks/subscriptions/mock`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-signature": signMockSubscriptionWebhookBody(body) },
    body,
  });

  return { ok: response.ok };
}
