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
import { getPaymentProviderByName } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";

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
        amountMinor: payment.amount_minor + payment.tip_amount_minor,
      });
      providerRef = result.refundRef;
    } catch {
      return { ok: false, error: "provider_failed" };
    }
  }

  const { data, error } = await supabase.rpc("record_refund", {
    p_payment_id: parsed.data.paymentId,
    p_reason_code_id: parsed.data.reasonCodeId,
    p_note: parsed.data.note ?? undefined,
    p_provider_ref: providerRef ?? undefined,
  });

  if (error) {
    if (error.message.includes("not refundable")) return { ok: false, error: "not_refundable" };
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
  });

  if (error) {
    if (error.message.includes("not active")) return { ok: false, error: "not_open" };
    return { ok: false, error: "forbidden" };
  }

  revalidatePath("/cashier/pay");
  return { ok: true, paymentId: data as string };
}
