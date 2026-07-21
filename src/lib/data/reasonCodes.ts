import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ReasonCodeOption = { id: string; name: string };

// call_types'ın getCallTypes'ı ile aynı desen (content_translations lookup).
export async function getReasonCodeOptions(
  tenantId: string,
  category: "comp" | "refund" | "cancel",
  locale: string,
): Promise<ReasonCodeOption[]> {
  const supabase = await createClient();

  const [codesRes, translationsRes] = await Promise.all([
    supabase
      .from("reason_codes")
      .select("id, key")
      .eq("tenant_id", tenantId)
      .eq("category", category)
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("content_translations")
      .select("entity_id, value")
      .eq("tenant_id", tenantId)
      .eq("entity_type", "reason_code")
      .eq("field", "name")
      .eq("locale", locale),
  ]);

  const nameMap = new Map((translationsRes.data ?? []).map((row) => [row.entity_id, row.value]));

  return (codesRes.data ?? []).map((code) => ({ id: code.id, name: nameMap.get(code.id) ?? code.key }));
}
