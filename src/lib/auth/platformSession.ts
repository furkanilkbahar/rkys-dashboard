import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CurrentPlatformAdmin = {
  userId: string;
};

/**
 * getCurrentActor() (personel) ve getCurrentGuestSession() (misafir) ile
 * aynı desen — JWT claim'inden okur (custom_access_token_hook, 0036
 * migration). is_platform_admin claim'i yalnızca platform_admins tablosunda
 * aktif satırı olan kullanıcılar için basılır (fail-closed).
 */
export async function getCurrentPlatformAdmin(): Promise<CurrentPlatformAdmin | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data) {
    return null;
  }

  const claims = data.claims as Record<string, unknown>;
  const userId = typeof claims.sub === "string" ? claims.sub : null;
  const isPlatformAdmin = claims.is_platform_admin === true;

  if (!userId || !isPlatformAdmin) {
    return null;
  }

  return { userId };
}
