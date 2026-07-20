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
): Promise<StaffOrderView[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      `id, status, created_at,
       table_sessions(tables(label)),
       order_items(product_name_snapshot, variant_name_snapshot, quantity)`,
    )
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .in("status", statuses)
    .order("created_at");

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
