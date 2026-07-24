import "server-only";

import { createClient } from "@/lib/supabase/server";

export type SyncableOrder = { id: string; channel: string; subtotalMinor: number; createdAt: string };
export type AccountingSyncLogEntry = { id: string; orderId: string; status: "success" | "failed"; externalRef: string | null; errorMessage: string | null; syncedAt: string };

// Senkronize edilebilir siparişler: 'served' (tamamlanmış) ve henüz
// başarılı bir accounting_sync_log satırı olmayanlar (bkz. 0067 migration
// yorumu — birden fazla deneme olabileceği için UNIQUE(order_id) yok, bu
// yüzden filtre burada, iki sorguyla yapılır).
export async function getSyncableOrders(tenantId: string, limit = 50): Promise<SyncableOrder[]> {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, channel, subtotal_minor, created_at")
    .eq("tenant_id", tenantId)
    .eq("status", "served")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!orders || orders.length === 0) return [];

  const { data: syncedRows } = await supabase
    .from("accounting_sync_log")
    .select("order_id")
    .eq("tenant_id", tenantId)
    .eq("status", "success")
    .in(
      "order_id",
      orders.map((o) => o.id),
    );
  const syncedOrderIds = new Set((syncedRows ?? []).map((r) => r.order_id));

  return orders
    .filter((o) => !syncedOrderIds.has(o.id))
    .map((o) => ({ id: o.id, channel: o.channel, subtotalMinor: o.subtotal_minor, createdAt: o.created_at }));
}

export async function getAccountingSyncLog(tenantId: string, limit = 20): Promise<AccountingSyncLogEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounting_sync_log")
    .select("id, order_id, status, external_ref, error_message, synced_at")
    .eq("tenant_id", tenantId)
    .order("synced_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id,
    orderId: row.order_id,
    status: row.status as "success" | "failed",
    externalRef: row.external_ref,
    errorMessage: row.error_message,
    syncedAt: row.synced_at,
  }));
}
