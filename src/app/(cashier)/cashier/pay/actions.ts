"use server";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import { recordPaymentSchema, type RecordPaymentResult } from "@/lib/cashier/payment-schemas";
import { createClient } from "@/lib/supabase/server";

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
