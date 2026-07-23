import "server-only";

import { createHash, randomInt } from "node:crypto";

/**
 * lib/qr/token.ts'teki hashToken deseniyle aynı: ham kod asla saklanmaz,
 * yalnızca hash'i (otp_codes.code_hash). 6 haneli kod kısa ömürlü (5dk) ve
 * rate limit'e (RPC içinde) tabi — güvenlik hash'in kendisinden değil bu
 * ikisinden gelir (RULES #38).
 */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** RULES #38: müşteri telefon numaraları UI'da maskeli gösterilir. */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  return `${phone.slice(0, phone.length - 4).replace(/\d/g, "*")}${phone.slice(-4)}`;
}
