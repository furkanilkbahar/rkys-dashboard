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

  return { userId, tenantId, role: role as CurrentActor["role"] };
}