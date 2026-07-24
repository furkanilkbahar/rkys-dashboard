import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

export type ApiOrder = {
  id: string;
  channel: string;
  status: string;
  subtotalMinor: number;
  createdAt: string;
  items: { productName: string; variantName: string | null; quantity: number; unitPriceMinor: number }[];
};

/**
 * Tenant API'nin read-only sipariş listesi — service_role ile çalışır (API
 * key'in Supabase oturumu yok), bu yüzden tenant_id filtresi RLS'ten değil
 * BURADAN gelir (bkz. lib/api/auth.ts'teki güvenlik notu). p_limit sabit bir
 * tavana sahiptir (kazara/kötü niyetli tam tablo dökümünü önler).
 */
export async function getApiOrders(tenantId: string, limit = 50): Promise<ApiOrder[]> {
  const cappedLimit = Math.min(Math.max(limit, 1), 200);
  const supabase = createServiceRoleClient();

  const { data } = await supabase
    .from("orders")
    .select("id, channel, status, subtotal_minor, created_at, order_items(product_name_snapshot, variant_name_snapshot, quantity, unit_price_minor)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(cappedLimit);

  return (data ?? []).map((o) => ({
    id: o.id,
    channel: o.channel,
    status: o.status,
    subtotalMinor: o.subtotal_minor,
    createdAt: o.created_at,
    items: o.order_items.map((item) => ({
      productName: item.product_name_snapshot,
      variantName: item.variant_name_snapshot,
      quantity: item.quantity,
      unitPriceMinor: item.unit_price_minor,
    })),
  }));
}
