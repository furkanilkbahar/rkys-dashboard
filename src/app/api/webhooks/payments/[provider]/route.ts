import { NextResponse } from "next/server";

import { getPaymentProviderByName } from "@/lib/payments";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Ödeme sağlayıcısı webhook'u — kimliksiz (JWT yok, sağlayıcı çağırıyor).
 * RULES #6/#40: imza doğrulanmadan hiçbir olay işlenmez; complete_online_payment
 * RPC'si yalnızca service_role'e grant'li (0032).
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerName } = await params;
  const provider = getPaymentProviderByName(providerName);
  if (!provider) {
    return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const event = await provider.verifyAndParseWebhook(rawBody, signature);
  if (!event) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (event.type === "payment_succeeded") {
    const service = createServiceRoleClient();
    const { error } = await service.rpc("complete_online_payment", {
      p_provider: provider.name,
      p_provider_ref: event.providerRef,
    });
    if (error) {
      return NextResponse.json({ error: "processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
