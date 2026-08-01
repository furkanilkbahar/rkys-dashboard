"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentActor } from "@/lib/auth/session";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getOrdersByStatus, type StaffOrderView } from "@/lib/data/staffOrders";
import { getOpenWaiterCalls, type WaiterCallView } from "@/lib/data/waiterCalls";
import { createClient } from "@/lib/supabase/server";
import { createWaiterClient } from "@/lib/supabase/waiterClient";

const idSchema = z.object({ id: z.uuid() });

export type MoveTableResult = { ok: true } | { ok: false; error: "forbidden" | "occupied" | "invalid_destination" | "unknown" };

function mapMoveTableError(message: string | undefined): Extract<MoveTableResult, { ok: false }>["error"] {
  if (!message) return "unknown";
  if (message.includes("PERMISSION_DENIED") || message.includes("staff only")) return "forbidden";
  if (message.includes("already occupied")) return "occupied";
  if (message.includes("invalid destination") || message.includes("not active")) return "invalid_destination";
  return "unknown";
}

export async function moveTableSession(tableSessionId: string, toTableId: string): Promise<MoveTableResult> {
  const parsed = z.object({ tableSessionId: z.uuid(), toTableId: z.uuid() }).safeParse({ tableSessionId, toTableId });
  if (!parsed.success) return { ok: false, error: "unknown" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("move_table_session", {
    p_table_session_id: parsed.data.tableSessionId,
    p_to_table_id: parsed.data.toTableId,
  });
  if (error) return { ok: false, error: mapMoveTableError(error.message) };

  revalidatePath("/waiter");
  return { ok: true };
}

export async function acknowledgeCall(input: { id: string }): Promise<{ ok: boolean }> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("acknowledge_waiter_call", { p_call_id: parsed.data.id });
  return { ok: !error };
}

export async function approveOrder(input: { id: string }): Promise<{ ok: boolean }> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_order", { p_order_id: parsed.data.id });
  return { ok: !error };
}

export type WaiterPaymentNotice = { id: string; tableLabel: string; method: string };

/**
 * Realtime postgres_changes event'i kaçırılırsa (bağlantı kopması, kanal
 * yeniden bağlanması, lokal Realtime'ın bilinen tenant_id filtre sorunu —
 * bkz. PLAN.md Faz 19) diye D30 dayanıklılık deseni: bu, waiter-panel'in
 * hem abonelik SUBSCRIBED olduğu an hem de kısa aralıklı yoklamada çağırdığı
 * güvenlik ağı. session-panel.tsx'teki aynı desenin garson tarafı karşılığı.
 *
 * Ödeme bildirimleri (bug-hunt 2026-08-01) doğrudan realtime kanalına değil
 * yalnızca bu yoklamaya bağlıdır — yerel Supabase Realtime'da tek başına bir
 * `payments` kanalı bile (waiter_calls/orders'tan bağımsız, ayrı bir kanal
 * olmasına rağmen) postgres_changes event'ini hiç tetiklemedi; kök nedeni
 * netleşmedi (PLAN.md Faz 19'daki bilinen tenant_id filtre sorunuyla aynı
 * ailede olabilir) ama D30 deseni zaten burada güvenilir bir alternatif
 * sunuyor, bu yüzden ayrı bir kanal yerine `sincePaymentsIso` imleciyle
 * mevcut yoklamaya eklendi.
 */
export async function refetchWaiterPanel(
  sincePaymentsIso?: string,
): Promise<{ calls: WaiterCallView[]; pendingOrders: StaffOrderView[]; newPayments: WaiterPaymentNotice[] }> {
  const actor = await getCurrentActor();
  if (!actor) return { calls: [], pendingOrders: [], newPayments: [] };

  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) return { calls: [], pendingOrders: [], newPayments: [] };

  const locale = await getLocale();
  const supabase = await createClient();
  const [calls, pendingOrders, paymentsRes] = await Promise.all([
    getOpenWaiterCalls(actor.tenantId, branchId, locale),
    getOrdersByStatus(actor.tenantId, branchId, ["pending"]),
    sincePaymentsIso
      ? supabase
          .from("payments")
          .select("id, method, created_at, table_sessions(tables(label))")
          .eq("tenant_id", actor.tenantId)
          .eq("branch_id", branchId)
          .gt("created_at", sincePaymentsIso)
          .order("created_at")
      : Promise.resolve({ data: null }),
  ]);

  const newPayments: WaiterPaymentNotice[] = (paymentsRes.data ?? []).map((p) => ({
    id: p.id,
    tableLabel: p.table_sessions?.tables?.label ?? "?",
    method: p.method,
  }));

  return { calls, pendingOrders, newPayments };
}

/**
 * D87: yalnızca garson PIN oturumunu (ayrı cookie) kapatır — owner/manager
 * kendi admin oturumuyla /waiter'a girdiyse bu no-op'tur (o zaten hiç PIN
 * oturumu açmamıştır), admin oturumları etkilenmez.
 */
export async function logoutWaiter(): Promise<void> {
  const waiterClient = await createWaiterClient();
  await waiterClient.auth.signOut({ scope: "local" });
}
