import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/orders/stateMachine";

export type SessionOrderItem = {
  name: string;
  variantName: string | null;
  quantity: number;
  lineSubtotalMinor: number;
};

export type SessionOrder = {
  id: string;
  status: OrderStatus;
  deviceLabel: string;
  createdAt: string;
  subtotalMinor: number;
  items: SessionOrderItem[];
};

// D24: tüm oturum siparişleri + cihaz bazlı etiket. İsim/fiyat snapshot'tan
// okunur (RULES #18) — çeviri lookup'ına gerek yok.
export async function getSessionOrders(tableSessionId: string): Promise<SessionOrder[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      `id, status, created_at, subtotal_minor,
       table_session_devices(device_label),
       order_items(product_name_snapshot, variant_name_snapshot, quantity, line_subtotal_minor)`,
    )
    .eq("table_session_id", tableSessionId)
    .order("created_at");

  return (data ?? []).map((order) => ({
    id: order.id,
    status: order.status as OrderStatus,
    deviceLabel: order.table_session_devices?.device_label ?? "?",
    createdAt: order.created_at,
    subtotalMinor: order.subtotal_minor,
    items: order.order_items.map((item) => ({
      name: item.product_name_snapshot,
      variantName: item.variant_name_snapshot,
      quantity: item.quantity,
      lineSubtotalMinor: item.line_subtotal_minor,
    })),
  }));
}
