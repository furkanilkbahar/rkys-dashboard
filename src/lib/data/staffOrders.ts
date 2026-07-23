import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/orders/stateMachine";

export type StaffOrderView = {
  id: string;
  status: OrderStatus;
  tableLabel: string;
  createdAt: string;
  items: { name: string; variantName: string | null; quantity: number }[];
};

export async function getOrdersByStatus(
  tenantId: string,
  branchId: string,
  statuses: OrderStatus[],
  station?: string,
): Promise<StaffOrderView[]> {
  const supabase = await createClient();

  // İstasyon seçiliyse order_items!inner + nested filtre: hem sipariş
  // yalnızca o istasyondan en az bir kalem içeriyorsa listelenir hem de
  // gösterilen kalem listesi o istasyona daralır (bir istasyon ekranının
  // diğer istasyonların kalemlerini görmesi gerekmez). Seçili değilse (v1
  // varsayılan) davranış birebir öncekiyle aynı — tüm kalemler görünür.
  const itemsSelect = station
    ? "order_items!inner(product_name_snapshot, variant_name_snapshot, quantity, products!inner(menu_categories!inner(station)))"
    : "order_items(product_name_snapshot, variant_name_snapshot, quantity)";

  let query = supabase
    .from("orders")
    .select(`id, status, created_at, table_sessions(tables(label)), ${itemsSelect}`)
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .in("status", statuses)
    .order("created_at");

  if (station) {
    query = query.eq("order_items.products.menu_categories.station", station);
  }

  const { data } = await query;

  return (data ?? []).map((order) => ({
    id: order.id,
    status: order.status as OrderStatus,
    tableLabel: order.table_sessions?.tables?.label ?? "?",
    createdAt: order.created_at,
    items: order.order_items.map((item) => ({
      name: item.product_name_snapshot,
      variantName: item.variant_name_snapshot,
      quantity: item.quantity,
    })),
  }));
}

/** Mutfak istasyon seçicisi için tenant'ta tanımlı benzersiz istasyon adları. */
export async function getStations(tenantId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("menu_categories")
    .select("station")
    .eq("tenant_id", tenantId)
    .not("station", "is", null);

  return [...new Set((data ?? []).map((c) => c.station as string))].sort();
}
