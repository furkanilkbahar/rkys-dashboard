import "server-only";

import { maskPhone } from "@/lib/customer/otp";
import { createClient } from "@/lib/supabase/server";

export type AdminLoyaltyProgram = {
  mode: "stamp" | "points";
  config: Record<string, number>;
  isActive: boolean;
} | null;

export async function getAdminLoyaltyProgram(tenantId: string): Promise<AdminLoyaltyProgram> {
  const supabase = await createClient();
  const { data } = await supabase.from("loyalty_programs").select("mode, config, is_active").eq("tenant_id", tenantId).maybeSingle();

  if (!data) {
    return null;
  }

  return { mode: data.mode as "stamp" | "points", config: data.config as Record<string, number>, isActive: data.is_active };
}

export type AdminLoyaltyCustomer = {
  id: string;
  maskedPhone: string;
  balance: number;
  createdAt: string;
};

/** RULES #38: telefon numaraları burada (server-side) maskelenir, ham numara hiç client'a gitmez. */
export async function getAdminLoyaltyCustomers(tenantId: string): Promise<AdminLoyaltyCustomer[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, phone, created_at, loyalty_balances(balance)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((c) => ({
    id: c.id,
    maskedPhone: maskPhone(c.phone),
    balance: c.loyalty_balances?.balance ?? 0,
    createdAt: c.created_at,
  }));
}

/** Misafirin kendi bakiyesi — loyalty_balances_select_own_session RLS'i (0054). */
export async function getSessionLoyaltyBalance(customerId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("loyalty_balances").select("balance").eq("customer_id", customerId).maybeSingle();
  return data?.balance ?? 0;
}
