"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentActor } from "@/lib/auth/session";
import { getDefaultAccountingProvider } from "@/lib/integrations/accounting";
import type { AccountingActionResult } from "@/lib/accounting/schemas";
import { isEnabled } from "@/lib/modules/isEnabled";
import { createClient } from "@/lib/supabase/server";

export async function syncOrderToAccounting(orderId: string): Promise<AccountingActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (actor.role !== "owner") return { ok: false, error: "forbidden" };
  if (!z.uuid().safeParse(orderId).success) return { ok: false, error: "unknown" };
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

  // Eşzamanlı çift-gönderim koruması: bu siparişe ait aktif (pending/success)
  // bir kayıt varsa DB'nin partial unique index'i (0071) ikinci "claim"i
  // reddeder — dış sağlayıcıyı ÇAĞIRMADAN önce claim edilir, TOCTOU kapanır.
  const { data: claim, error: claimError } = await supabase
    .from("accounting_sync_log")
    .insert({ tenant_id: actor.tenantId, order_id: order.id, provider: provider.name, status: "pending" })
    .select("id")
    .single();
  if (claimError || !claim) return { ok: false, error: "already_synced" };

  try {
    const result = await provider.syncOrderInvoice({
      orderId: order.id,
      subtotalMinor: order.subtotal_minor,
      currency: tenant?.currency ?? "TRY",
      createdAt: order.created_at,
    });
    await supabase.from("accounting_sync_log").update({ status: "success", external_ref: result.externalRef }).eq("id", claim.id);
    revalidatePath("/admin/accounting");
    return { ok: true, externalRef: result.externalRef };
  } catch (err) {
    await supabase
      .from("accounting_sync_log")
      .update({ status: "failed", error_message: err instanceof Error ? err.message : "unknown error" })
      .eq("id", claim.id);
    revalidatePath("/admin/accounting");
    return { ok: false, error: "unknown" };
  }
}
