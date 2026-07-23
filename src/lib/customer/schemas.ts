import { z } from "zod";

const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

export const requestOtpSchema = z.object({
  phone: z.string().regex(PHONE_PATTERN, "invalid_phone"),
});
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: z.string().regex(PHONE_PATTERN, "invalid_phone"),
  code: z.string().regex(/^[0-9]{6}$/, "invalid_code"),
  kvkkConsent: z.literal(true),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export type RequestOtpResult = { ok: true } | { ok: false; error: "invalid_input" | "no_session" | "rate_limited" | "not_enabled" | "unknown" };

export type VerifyOtpResult =
  | { ok: true; customerId: string }
  | { ok: false; error: "invalid_input" | "no_session" | "invalid_code" | "not_enabled" | "unknown" };
