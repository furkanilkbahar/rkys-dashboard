import "server-only";

import { createClient } from "@/lib/supabase/server";

export type WaiterCallView = {
  id: string;
  tableLabel: string;
  callTypeName: string | null;
  note: string | null;
  createdAt: string;
};

export async function getOpenWaiterCalls(
  tenantId: string,
  branchId: string,
  locale: string,
): Promise<WaiterCallView[]> {
  const supabase = await createClient();

  const [callsRes, translationsRes] = await Promise.all([
    supabase
      .from("waiter_calls")
      .select("id, note, created_at, call_type_id, table_sessions(tables(label))")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("status", "open")
      .order("created_at"),
    supabase
      .from("content_translations")
      .select("entity_id, value")
      .eq("tenant_id", tenantId)
      .eq("entity_type", "call_type")
      .eq("field", "name")
      .eq("locale", locale),
  ]);

  const nameMap = new Map((translationsRes.data ?? []).map((row) => [row.entity_id, row.value]));

  return (callsRes.data ?? []).map((call) => ({
    id: call.id,
    tableLabel: call.table_sessions?.tables?.label ?? "?",
    callTypeName: call.call_type_id ? (nameMap.get(call.call_type_id) ?? null) : null,
    note: call.note,
    createdAt: call.created_at,
  }));
}
