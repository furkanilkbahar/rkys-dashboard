"use server";

import { applyCouponSchema, type ApplyCouponResult } from "@/lib/campaigns/schemas";
import { getCurrentGuestSession } from "@/lib/guest/session";
import { isEnabled } from "@/lib/modules/isEnabled";
import { createClient } from "@/lib/supabase/server";

export async function applyCoupon(input: unknown): Promise<ApplyCouponResult> {
  const parsed = applyCouponSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const guest = await getCurrentGuestSession();
  if (!guest) {
    return { ok: false, error: "no_session" };
  }

  if (!(await isEnabled(guest.tenantId, "campaigns"))) {
    return { ok: false, error: "invalid_code" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_coupon_to_order", {
    p_order_id: parsed.data.orderId,
    p_code: parsed.data.code,
  });

  if (error) {
    if (error.message.includes("campaigns module not enabled")) return { ok: false, error: "invalid_code" };
    if (error.message.includes("invalid coupon code")) return { ok: false, error: "invalid_code" };
    if (error.message.includes("usage limit reached")) return { ok: false, error: "limit_reached" };
    if (error.message.includes("already applied")) return { ok: false, error: "already_applied" };
    if (
      error.message.includes("campaign not started") ||
      error.message.includes("campaign ended") ||
      error.message.includes("campaign not active")
    ) {
      return { ok: false, error: "not_active" };
    }
    if (error.message.includes("not applicable") || error.message.includes("already fully comped")) {
      return { ok: false, error: "not_applicable" };
    }
    if (error.message.includes("forbidden") || error.message.includes("order not eligible")) {
      return { ok: false, error: "forbidden" };
    }
    return { ok: false, error: "unknown" };
  }

  return { ok: true, discountMinor: data as number };
}
