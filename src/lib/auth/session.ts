import "server-only";

import { createClient } from "@/lib/supabase/server";

const STAFF_ROLES = ["owner", "manager", "waiter", "kitchen", "courier"] as const;

export type CurrentActor = {
  userId: string;
  tenantId: string;
  role: (typeof STAFF_ROLES)[number];
};

/**
 * Oturum açmış kullanıcının tenant_id/role bilgisini JWT claim'inden okur
 * (custom_access_token_hook, 0006 migration, bkz. getClaims() — app_metadata
 * değil, hook'un JWT'ye bastığı özel claim'ler). Claim yoksa (profil silinmiş,
 * hook henüz tetiklenmemiş) null döner — fail-closed.
 */
export async function getCurrentActor(): Promise<CurrentActor | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data) {
    return null;
  }

  const claims = data.claims as Record<string, unknown>;
  const userId = typeof claims.sub === "string" ? claims.sub : null;
  const tenantId = typeof claims.tenant_id === "string" ? claims.tenant_id : null;
  const role = typeof claims.user_role === "string" ? claims.user_role : null;

  if (!userId || !tenantId || !role) {
    return null;
  }

  // Faz 1'den itibaren misafirler de JWT'de user_role='guest' taşıyabilir —
  // burası yalnızca personel claim'lerini kabul eder (fail-closed).
  if (!STAFF_ROLES.includes(role as CurrentActor["role"])) {
    return null;
  }

  // Faz 4 Adım 1 (S14): Süper Admin bir tenant'ı askıya alınca personelin
  // TÜM yüzeyleri (sayfa + server action) kilitlenir. Subdomain proxy'si
  // (src/proxy.ts) sayfa isteklerini zaten /tenant-not-found'a yönlendiriyor;
  // buradaki kontrol server action'lar gibi doğrudan Supabase'e giden
  // çağrılar için ikinci bir savunma katmanı. is_tenant_active() RPC'si
  // kullanılır (0037) — tenants_select_own (0007) is_staff() zorunlu kıldığı
  // için bu, hem personel hem misafir tarafında (guest/session.ts) çalışan
  // tek bir yol.
  const { data: isActive } = await supabase.rpc("is_tenant_active", { p_tenant_id: tenantId });
  if (!isActive) {
    return null;
  }

  return { userId, tenantId, role: role as CurrentActor["role"] };
}