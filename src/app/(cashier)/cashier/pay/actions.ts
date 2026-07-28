"use server";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import {
  recordCompSchema,
  refundPaymentSchema,
  type RecordCompResult,
  type RefundPaymentResult,
} from "@/lib/cashier/comp-refund-schemas";
import { recordPaymentSchema, type RecordPaymentResult } from "@/lib/cashier/payment-schemas";
import { getAdminTenantSettings } from "@/lib/data/adminSettings";
import { getFiscalProvider } from "@/lib/integrations/fiscal";
import { isEnabled } from "@/lib/modules/isEnabled";
import { getPaymentProviderByName } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Fiskal fiş kesimi ödemenin tamamlanmasını asla bloklamamalı — gerçek
// hayatta fişi cihaz kesemezse bile ödeme geçerlidir, kasiyer daha sonra
// manuel olarak ilgilenir. Bu yüzden hata yutulur (best-effort side effect).
async function issueFiscalReceiptIfEnabled(
  supabase: SupabaseServerClient,
  tenantId: string,
  tableSessionId: string,
  paymentId: string,
  totalMinor: number,
): Promise<void> {
  try {
    if (!(await isEnabled(tenantId, "fiscal_integration"))) return;

    const [{ data: session }, settings] = await Promise.all([
      supabase.from("table_sessions").select("branch_id").eq("id", tableSessionId).single(),
      getAdminTenantSettings(tenantId),
    ]);
    if (!session) return;

    const provider = getFiscalProvider();
    const receipt = await provider.printFiscalReceipt({ paymentId, totalMinor, currency: settings?.currency ?? "TRY" });

    await supabase.from("fiscal_receipts").insert({
      tenant_id: tenantId,
      branch_id: session.branch_id,
      payment_id: paymentId,
      provider: provider.name,
      provider_ref: receipt.fiscalReceiptRef,
    });
  } catch (err) {
    console.error("fiscal receipt issuance failed", err);
  }
}

export async function recordComp(input: unknown): Promise<RecordCompResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = recordCompSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_comp", {
    p_order_id: parsed.data.orderId,
    p_amount_minor: parsed.data.amountMinor,
    p_reason_code_id: parsed.data.reasonCodeId,
    p_note: parsed.data.note ?? undefined,
  });

  if (error) {
    if (error.message.includes("exceeds order subtotal")) return { ok: false, error: "exceeds_subtotal" };
    if (error.message.includes("forbidden")) return { ok: false, error: "forbidden" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/cashier/pay");
  return { ok: true, compId: data as string };
}

export async function refundPayment(input: unknown): Promise<RefundPaymentResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = refundPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("method, provider, provider_ref, amount_minor, tip_amount_minor")
    .eq("id", parsed.data.paymentId)
    .single();
  if (!payment) return { ok: false, error: "not_refundable" };

  let providerRef: string | null = null;
  if (payment.method === "online") {
    const provider = getPaymentProviderByName(payment.provider);
    if (!provider || !payment.provider_ref) return { ok: false, error: "not_refundable" };
    try {
      const result = await provider.refund({
        providerRef: payment.provider_ref,
        amountMinor: parsed.data.amountMinor,
      });
      providerRef = result.refundRef;
    } catch {
      return { ok: false, error: "provider_failed" };
    }
  }

  const { data, error } = await supabase.rpc("record_refund", {
    p_payment_id: parsed.data.paymentId,
    p_amount_minor: parsed.data.amountMinor,
    p_reason_code_id: parsed.data.reasonCodeId,
    p_note: parsed.data.note ?? undefined,
    p_provider_ref: providerRef ?? undefined,
    p_item_allocations: parsed.data.itemAllocations ?? undefined,
  });

  if (error) {
    if (error.message.includes("not refundable")) return { ok: false, error: "not_refundable" };
    if (error.message.includes("exceeds remaining payment balance") || error.message.includes("item refund exceeds paid quantity")) {
      return { ok: false, error: "exceeds_remaining" };
    }
    if (error.message.includes("do not match amount")) return { ok: false, error: "invalid_input" };
    if (error.message.includes("forbidden")) return { ok: false, error: "forbidden" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/cashier/pay");
  return { ok: true, refundId: data as string };
}

export async function recordPayment(input: unknown): Promise<RecordPaymentResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_payment", {
    p_table_session_id: parsed.data.tableSessionId,
    p_method: parsed.data.method,
    p_amount_minor: parsed.data.amountMinor,
    p_tip_amount_minor: parsed.data.tipAmountMinor,
    p_split_group: parsed.data.splitGroup ?? undefined,
    p_item_allocations: parsed.data.itemAllocations ?? undefined,
    p_gift_card_code: parsed.data.giftCardCode ?? undefined,
  });

  if (error) {
    if (error.message.includes("not active")) return { ok: false, error: "not_open" };
    if (error.message.includes("do not match amount") || error.message.includes("invalid order item allocation") || error.message.includes("exceeds ordered quantity")) {
      return { ok: false, error: "invalid_input" };
    }
    if (error.message.includes("invalid gift card code") || error.message.includes("gift card code required")) {
      return { ok: false, error: "invalid_gift_card" };
    }
    if (error.message.includes("insufficient gift card balance")) return { ok: false, error: "insufficient_gift_card_balance" };
    return { ok: false, error: "forbidden" };
  }

  const paymentId = data as string;
  await issueFiscalReceiptIfEnabled(
    supabase,
    actor.tenantId,
    parsed.data.tableSessionId,
    paymentId,
    parsed.data.amountMinor + parsed.data.tipAmountMinor,
  );

  revalidatePath("/cashier/pay");
  return { ok: true, paymentId };
}
