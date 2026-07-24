import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getPickupCode(tableSessionId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("table_sessions").select("pickup_code").eq("id", tableSessionId).maybeSingle();
  return data?.pickup_code ?? null;
}
