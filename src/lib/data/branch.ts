import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * D39: tenant görünmez tek şubeyle başlar; çok şubeli seçici altyapısı
 * gelecek fazda UI'a çıkar. Faz 1'in personel yüzeyleri (garson/KDS)
 * şimdilik varsayılan şubeyi kullanır.
 */
export async function getDefaultBranchId(tenantId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("branches")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .maybeSingle();

  return data?.id ?? null;
}
