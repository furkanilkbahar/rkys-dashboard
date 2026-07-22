import { NextResponse } from "next/server";

import { getSubscriptionProviderByName } from "@/lib/subscriptions";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Abonelik sağlayıcısı webhook'u — kimliksiz (JWT yok, sağlayıcı çağırıyor).
 * RULES #6/#40: imza doğrulanmadan hiçbir olay işlenmez; activate_subscription
 * RPC'si yalnızca service_role'e grant'li (0039) — payments webhook'uyla
 * (src/app/api/webhooks/payments/[provider]/route.ts) birebir aynı desen.
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerName } = await params;
  const provider = getSubscriptionProviderByName(providerName);
  if (!provider) {
    return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const event = await provider.verifyAndParseWebhook(rawBody, signature);
  if (!event) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (event.type === "subscription_activated") {
    const service = createServiceRoleClient();
    const { error } = await service.rpc("activate_subscription", {
      p_provider: provider.name,
      p_provider_ref: event.providerRef,
    });
    if (error) {
      return NextResponse.json({ error: "processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
