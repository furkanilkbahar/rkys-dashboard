"use server";

import { headers } from "next/headers";

import { signMockSubscriptionWebhookBody } from "@/lib/subscriptions/mock";

/**
 * Sahte checkout sayfasının (admin/billing/mock, kayit/odeme) paylaştığı tek
 * server action — kimliksiz webhook POST'u (RULES #6) sağlayıcının kendisi
 * gibi imzalı gönderir, hangi domainden çağrıldığına bakılmaksızın aynı
 * davranır (root domain için de proxy.ts host===ROOT_DOMAIN dalını kullanır).
 */
export async function confirmMockSubscriptionPayment(providerRef: string): Promise<{ ok: boolean }> {
  const headerStore = await headers();
  const origin = `${headerStore.get("x-forwarded-proto") ?? "http"}://${headerStore.get("host")}`;

  const body = JSON.stringify({ providerRef, status: "succeeded" });
  const response = await fetch(`${origin}/api/webhooks/subscriptions/mock`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-signature": signMockSubscriptionWebhookBody(body) },
    body,
  });

  return { ok: response.ok };
}
