import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * QR token'ları ardışık/tahmin edilebilir olamaz (RULES #7) — 32 byte
 * kriptografik rastgelelik. Ham token asla DB'de saklanmaz, yalnızca
 * hash'i (hashToken) — bkz. tables.qr_token_hash / generic_qr_codes.qr_token_hash.
 */
export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
