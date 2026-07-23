import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/orders/stateMachine";

export type SessionOrderItem = {
  id: string;
  name: string;
  variantName: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineSubtotalMinor: number;
  paidQuantity: number;
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
// payment_item_allocations yalnızca "completed" ödemelere karşılık gelir
// (record_payment yalnızca completed statüsünde satır yazıyor, 0049) — bir
// kalemin ne kadarının zaten ödendiğini burada toplarız ki "kalem seç"
// modu (pay-screen.tsx) yalnızca kalan miktarı seçtirebilsin.
export async function getSessionOrders(tableSessionId: string): Promise<SessionOrder[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      `id, status, created_at, subtotal_minor,
       table_session_devices(device_label),
       order_items(id, product_name_snapshot, variant_name_snapshot, quantity, unit_price_minor, line_subtotal_minor)`,
    )
    .eq("table_session_id", tableSessionId)
    .order("created_at");

  const orderItemIds = (data ?? []).flatMap((order) => order.order_items.map((item) => item.id));
  const paidQuantityByItemId = new Map<string, number>();
  if (orderItemIds.length > 0) {
    const { data: allocations } = await supabase
      .from("payment_item_allocations")
      .select("order_item_id, quantity")
      .in("order_item_id", orderItemIds);
    for (const row of allocations ?? []) {
      paidQuantityByItemId.set(row.order_item_id, (paidQuantityByItemId.get(row.order_item_id) ?? 0) + row.quantity);
    }
  }

  return (data ?? []).map((order) => ({
    id: order.id,
    status: order.status as OrderStatus,
    deviceLabel: order.table_session_devices?.device_label ?? "?",
    createdAt: order.created_at,
    subtotalMinor: order.subtotal_minor,
    items: order.order_items.map((item) => ({
      id: item.id,
      name: item.product_name_snapshot,
      variantName: item.variant_name_snapshot,
      quantity: item.quantity,
      unitPriceMinor: item.unit_price_minor,
      lineSubtotalMinor: item.line_subtotal_minor,
      paidQuantity: paidQuantityByItemId.get(item.id) ?? 0,
    })),
  }));
}
