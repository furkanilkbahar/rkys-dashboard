import "server-only";

import { hashApiKey } from "@/lib/api/keys";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Tenant API'nin tek kimlik doğrulama noktası — Authorization: Bearer
 * <ham anahtar> header'ını hash'leyip authenticate_api_key RPC'sine (0064)
 * sorar. Supabase JWT/cookie oturumu YOK; RLS bu istekler için devrede
 * değil, tenant izolasyonu bu fonksiyonun döndürdüğü tenantId'nin route
 * handler'larda EXPLICIT olarak her sorguya eklenmesine dayanır.
 */
export async function authenticateApiRequest(request: Request): Promise<{ tenantId: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const rawKey = authHeader.slice("Bearer ".length).trim();
  if (!rawKey) {
    return null;
  }

  const service = createServiceRoleClient();
  const { data: tenantId } = await service.rpc("authenticate_api_key", { p_key_hash: hashApiKey(rawKey) });

  return tenantId ? { tenantId } : null;
}
