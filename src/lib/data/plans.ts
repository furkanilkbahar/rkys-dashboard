import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Plan = {
  id: string;
  key: string;
  name: string;
};

// plans herkese açık okunur (marketing fiyatlandırma tablosu, Adım 6) —
// request-scoped client burada da yeterli, service-role'e gerek yok.
export async function getPlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plans")
    .select("id, key, name")
    .order("table_limit", { ascending: true, nullsFirst: false });

  return data ?? [];
}
