import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AdminDeliveryZone = { id: string; name: string; feeMinor: number; minBasketMinor: number; isActive: boolean };

export async function getAdminDeliveryZones(tenantId: string, branchId: string): Promise<AdminDeliveryZone[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_zones")
    .select("id, name, fee_minor, min_basket_minor, is_active")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .order("name");

  return (data ?? []).map((z) => ({ id: z.id, name: z.name, feeMinor: z.fee_minor, minBasketMinor: z.min_basket_minor, isActive: z.is_active }));
}

export type DeliveryZoneOption = { id: string; name: string; feeMinor: number; minBasketMinor: number };

export async function getActiveDeliveryZones(tenantId: string, branchId: string): Promise<DeliveryZoneOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_zones")
    .select("id, name, fee_minor, min_basket_minor")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("name");

  return (data ?? []).map((z) => ({ id: z.id, name: z.name, feeMinor: z.fee_minor, minBasketMinor: z.min_basket_minor }));
}
