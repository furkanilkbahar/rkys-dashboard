"use server";

import { headers } from "next/headers";

import { signMockWebhookBody } from "@/lib/payments/mock";

export async function confirmMockPayment(providerRef: string): Promise<{ ok: boolean }> {
  const headerStore = await headers();
  const origin = `${headerStore.get("x-forwarded-proto") ?? "http"}://${headerStore.get("host")}`;

  // Gerçek sağlayıcının sunucusu ne yapardıysa aynısı: imzalı bir webhook
  // POST'u — bu, verifyAndParseWebhook'un (RULES #6) gerçekten çalıştığını
  // uçtan uca kanıtlar, yalnızca RPC'yi doğrudan çağırmak değil.
  const body = JSON.stringify({ providerRef, status: "succeeded" });
  const response = await fetch(`${origin}/api/webhooks/payments/mock`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-signature": signMockWebhookBody(body) },
    body,
  });

  return { ok: response.ok };
}
