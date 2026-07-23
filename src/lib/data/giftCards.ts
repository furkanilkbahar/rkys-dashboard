import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AdminGiftCard = {
  id: string;
  code: string;
  balanceMinor: number;
  isActive: boolean;
  createdAt: string;
};

export async function getAdminGiftCards(tenantId: string): Promise<AdminGiftCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gift_cards")
    .select("id, code, balance_minor, is_active, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((g) => ({
    id: g.id,
    code: g.code,
    balanceMinor: g.balance_minor,
    isActive: g.is_active,
    createdAt: g.created_at,
  }));
}
