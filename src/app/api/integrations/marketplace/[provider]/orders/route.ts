import { NextResponse } from "next/server";

import { authenticateApiRequest } from "@/lib/api/auth";
import { getMarketplaceProvider } from "@/lib/integrations/marketplace";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Aracı platform (Posentegra/Entegre App/API Merkezi vb.) siparişi bu uca
// POST eder — kimlik doğrulama tenant API anahtarıyla (Faz 10 Adım 0)
// yapılır, tenant kendi anahtarını platforma verir. Tenant izolasyonu RLS
// ile değil, authenticateApiRequest'in döndürdüğü tenantId'nin RPC'ye
// explicit geçirilmesiyle sağlanır (lib/api/auth.ts'teki desenle aynı).
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { provider: providerName } = await params;
  const provider = getMarketplaceProvider(providerName);
  if (!provider) {
    return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  }

  const rawBody = await request.text();
  const parsed = provider.parseIncomingOrder(rawBody);
  if (!parsed) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data, error } = await service.rpc("ingest_marketplace_order", {
    p_tenant_id: auth.tenantId,
    p_provider: provider.name,
    p_external_order_id: parsed.externalOrderId,
    p_items: parsed.items.map((item) => ({
      externalSku: item.externalSku,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      name: item.name,
    })),
  });

  if (error) {
    const message = error.message.includes("SKU_NOT_MAPPED")
      ? "sku_not_mapped"
      : error.message.includes("marketplace module not enabled")
        ? "not_enabled"
        : "unknown";
    return NextResponse.json({ error: message }, { status: message === "unknown" ? 500 : 422 });
  }

  const result = data![0];
  return NextResponse.json({ orderId: result.order_id, isDuplicate: result.is_duplicate }, { status: result.is_duplicate ? 200 : 201 });
}
