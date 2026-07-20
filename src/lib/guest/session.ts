import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CurrentGuestSession = {
  userId: string;
  tenantId: string;
  branchId: string;
  tableSessionId: string;
};

/**
 * Misafirin (masa QR ile Supabase Anonymous Auth'a geçmiş müşteri) JWT
 * claim'lerini okur (custom_access_token_hook, 0012 migration). Personel
 * claim'i (getCurrentActor) ile kasıtlı olarak ayrı tutulur — biri diğerinin
 * yerine geçemez. Claim eksikse (bootstrap tamamlanmamış, oturum kapanmış)
 * null döner — fail-closed.
 */
export async function getCurrentGuestSession(): Promise<CurrentGuestSession | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data) {
    return null;
  }

  const claims = data.claims as Record<string, unknown>;
  const userId = typeof claims.sub === "string" ? claims.sub : null;
  const tenantId = typeof claims.tenant_id === "string" ? claims.tenant_id : null;
  const branchId = typeof claims.branch_id === "string" ? claims.branch_id : null;
  const tableSessionId = typeof claims.table_session_id === "string" ? claims.table_session_id : null;
  const role = typeof claims.user_role === "string" ? claims.user_role : null;

  if (role !== "guest" || !userId || !tenantId || !branchId || !tableSessionId) {
    return null;
  }

  return { userId, tenantId, branchId, tableSessionId };
}
