import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AdminApiKey = { id: string; name: string; keyPrefix: string; isActive: boolean; lastUsedAt: string | null; createdAt: string };

export async function getAdminApiKeys(tenantId: string): Promise<AdminApiKey[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, is_active, last_used_at, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.key_prefix,
    isActive: k.is_active,
    lastUsedAt: k.last_used_at,
    createdAt: k.created_at,
  }));
}
