import "server-only";

import { createClient } from "@/lib/supabase/server";

/** table_sessions_select RLS'i (0011) misafirin kendi oturumunu görmesine izin verir. */
export async function getSessionCustomerId(tableSessionId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("table_sessions").select("customer_id").eq("id", tableSessionId).maybeSingle();
  return data?.customer_id ?? null;
}
