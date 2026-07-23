"use server";

import { generateOtpCode, hashOtpCode } from "@/lib/customer/otp";
import { requestOtpSchema, verifyOtpSchema, type RequestOtpResult, type VerifyOtpResult } from "@/lib/customer/schemas";
import { getCurrentGuestSession } from "@/lib/guest/session";
import { getDefaultSmsProvider } from "@/lib/integrations/sms";
import { redeemLoyaltySchema, type RedeemLoyaltyResult } from "@/lib/loyalty/schemas";
import { isEnabled } from "@/lib/modules/isEnabled";
import { createClient } from "@/lib/supabase/server";

export async function requestLoyaltyOtp(input: unknown): Promise<RequestOtpResult> {
  const parsed = requestOtpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const guest = await getCurrentGuestSession();
  if (!guest) {
    return { ok: false, error: "no_session" };
  }

  if (!(await isEnabled(guest.tenantId, "crm_loyalty"))) {
    return { ok: false, error: "not_enabled" };
  }

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_loyalty_otp", {
    p_table_session_id: guest.tableSessionId,
    p_phone: parsed.data.phone,
    p_code_hash: codeHash,
  });

  if (error) {
    if (error.message.includes("RATE_LIMITED")) return { ok: false, error: "rate_limited" };
    if (error.message.includes("crm_loyalty module not enabled")) return { ok: false, error: "not_enabled" };
    return { ok: false, error: "unknown" };
  }

  const sms = getDefaultSmsProvider();
  await sms.sendSms({ tenantId: guest.tenantId, phone: parsed.data.phone, body: `Doğrulama kodunuz: ${code}` });

  return { ok: true };
}

export async function verifyLoyaltyOtp(input: unknown): Promise<VerifyOtpResult> {
  const parsed = verifyOtpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const guest = await getCurrentGuestSession();
  if (!guest) {
    return { ok: false, error: "no_session" };
  }

  if (!(await isEnabled(guest.tenantId, "crm_loyalty"))) {
    return { ok: false, error: "not_enabled" };
  }

  const codeHash = hashOtpCode(parsed.data.code);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_loyalty_otp", {
    p_table_session_id: guest.tableSessionId,
    p_phone: parsed.data.phone,
    p_code_hash: codeHash,
    p_kvkk_consent: parsed.data.kvkkConsent,
  });

  if (error) {
    if (error.message.includes("crm_loyalty module not enabled")) return { ok: false, error: "not_enabled" };
    return { ok: false, error: "invalid_code" };
  }

  return { ok: true, customerId: data as string };
}

export async function redeemLoyaltyPoints(input: unknown): Promise<RedeemLoyaltyResult> {
  const parsed = redeemLoyaltySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const guest = await getCurrentGuestSession();
  if (!guest) {
    return { ok: false, error: "no_session" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_loyalty_to_order", { p_order_id: parsed.data.orderId });

  if (error) {
    if (error.message.includes("crm_loyalty module not enabled")) return { ok: false, error: "not_enabled" };
    if (error.message.includes("no loyalty customer linked")) return { ok: false, error: "no_customer" };
    if (error.message.includes("loyalty program not active")) return { ok: false, error: "not_active" };
    if (error.message.includes("insufficient loyalty balance")) return { ok: false, error: "insufficient_balance" };
    if (error.message.includes("already fully comped")) return { ok: false, error: "not_applicable" };
    if (error.message.includes("forbidden") || error.message.includes("order not eligible")) return { ok: false, error: "forbidden" };
    return { ok: false, error: "unknown" };
  }

  return { ok: true, discountMinor: data as number };
}
