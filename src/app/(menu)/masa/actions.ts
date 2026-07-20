"use server";

import { getCurrentGuestSession } from "@/lib/guest/session";
import { submitOrderSchema, type SubmitOrderInput, type SubmitOrderResult } from "@/lib/orders/schemas";
import { createClient } from "@/lib/supabase/server";

export async function submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
  const parsed = submitOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const guest = await getCurrentGuestSession();
  if (!guest) {
    return { ok: false, error: "no_session" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_order", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_items: parsed.data.items,
  });

  if (error || !data || data.length === 0) {
    const message = error?.message ?? "";
    if (message.startsWith("STOCK_UNAVAILABLE")) {
      return { ok: false, error: "stock_unavailable" };
    }
    if (message === "RATE_LIMITED") {
      return { ok: false, error: "rate_limited" };
    }
    return { ok: false, error: "unknown" };
  }

  return {
    ok: true,
    orderId: data[0].order_id,
    status: data[0].order_status,
    subtotalMinor: data[0].subtotal_minor,
  };
}
