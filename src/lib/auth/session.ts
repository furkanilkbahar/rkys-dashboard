import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CurrentActor = {
  userId: string;
  tenantId: string;
  role: "owner" | "manager" | "waiter" | "kitchen" | "courier";
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

  return { userId, tenantId, role: role as CurrentActor["role"] };
}