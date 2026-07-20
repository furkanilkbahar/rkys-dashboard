import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CallTypeOption = { key: string; name: string };

export async function getCallTypes(tenantId: string, locale: string): Promise<CallTypeOption[]> {
  const supabase = await createClient();

  const [typesRes, translationsRes] = await Promise.all([
    supabase
      .from("call_types")
      .select("id, key")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("content_translations")
      .select("entity_id, value")
      .eq("tenant_id", tenantId)
      .eq("entity_type", "call_type")
      .eq("field", "name")
      .eq("locale", locale),
  ]);

  const nameMap = new Map((translationsRes.data ?? []).map((row) => [row.entity_id, row.value]));

  return (typesRes.data ?? []).map((type) => ({ key: type.key, name: nameMap.get(type.id) ?? type.key }));
}
