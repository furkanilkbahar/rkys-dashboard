"use server";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import { getDefaultAccountingProvider } from "@/lib/integrations/accounting";
import type { AccountingActionResult } from "@/lib/accounting/schemas";
import { isEnabled } from "@/lib/modules/isEnabled";
import { createClient } from "@/lib/supabase/server";

export async function syncOrderToAccounting(orderId: string): Promise<AccountingActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (!(await isEnabled(actor.tenantId, "accounting_export"))) return { ok: false, error: "not_enabled" };

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, subtotal_minor, created_at, status")
    .eq("id", orderId)
    .eq("tenant_id", actor.tenantId)
    .single();
  if (!order || order.status !== "served") return { ok: false, error: "unknown" };

  const { data: tenant } = await supabase.from("tenants").select("currency").eq("id", actor.tenantId).single();

  const provider = getDefaultAccountingProvider();
  try {
    const result = await provider.syncOrderInvoice({
      orderId: order.id,
      subtotalMinor: order.subtotal_minor,
      currency: tenant?.currency ?? "TRY",
      createdAt: order.created_at,
    });
    await supabase.from("accounting_sync_log").insert({
      tenant_id: actor.tenantId,
      order_id: order.id,
      provider: provider.name,
      status: "success",
      external_ref: result.externalRef,
    });
    revalidatePath("/admin/accounting");
    return { ok: true, externalRef: result.externalRef };
  } catch (err) {
    await supabase.from("accounting_sync_log").insert({
      tenant_id: actor.tenantId,
      order_id: order.id,
      provider: provider.name,
      status: "failed",
      error_message: err instanceof Error ? err.message : "unknown error",
    });
    revalidatePath("/admin/accounting");
    return { ok: false, error: "unknown" };
  }
}
