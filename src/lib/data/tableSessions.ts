import "server-only";

import { createClient } from "@/lib/supabase/server";

export type OccupiedTable = { tableSessionId: string; tableId: string; tableLabel: string };

// Masa taşıma (RULES #27, garson paneli) için: şu an dolu (aktif oturumlu,
// fiziksel masaya bağlı) masaların listesi. Gel-Al/paket/kiosk/pazar yeri
// oturumları table_id=null olduğundan zaten hariç kalır (kanal tek motoru —
// yalnızca fiziksel masalar taşınabilir, bu diğer kanallar için anlamsız).
export async function getOccupiedTables(tenantId: string, branchId: string): Promise<OccupiedTable[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("table_sessions")
    .select("id, table_id, tables(label)")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("status", "active")
    .not("table_id", "is", null)
    .order("last_activity_at", { ascending: false });

  return (data ?? []).map((s) => ({
    tableSessionId: s.id,
    tableId: s.table_id!,
    tableLabel: s.tables?.label ?? "?",
  }));
}
