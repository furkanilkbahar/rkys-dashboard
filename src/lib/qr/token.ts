import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * QR token'ları ardışık/tahmin edilebilir olamaz (RULES #7) — 32 byte
 * kriptografik rastgelelik. Ham token doğrulama için hash'lenir (hashToken)
 * — bkz. tables.qr_token_hash / generic_qr_codes.qr_token_hash.
 */
export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// D86 (bug-hunt 2026-08-01): "QR göster" (fiziksel QR'ı bozmadan tekrar
// görüntüleme) talebi üzerine ham token'ın AYRICA (hash'e ek olarak, onun
// yerine değil) şifreli bir kopyası saklanır — bkz. tables.qr_token_encrypted
// / generic_qr_codes.qr_token_encrypted. Anahtar yalnızca bu env
// değişkeninde yaşar (LICENSE_SIGNING_PRIVATE_KEY ile aynı desen, sign.ts).
// Anahtar yoksa şifreleme atlanır (kolon null kalır) — mevcut oluşturma/
// yenileme akışları bu özellik olmadan da çalışmaya devam eder.
function getEncryptionKey(): Buffer | null {
  const raw = process.env.QR_TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("QR_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (base64)");
  }
  return key;
}

export function encryptToken(rawToken: string): string | null {
  const key = getEncryptionKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(rawToken, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptToken(encrypted: string): string | null {
  const key = getEncryptionKey();
  if (!key) return null;
  const buf = Buffer.from(encrypted, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
