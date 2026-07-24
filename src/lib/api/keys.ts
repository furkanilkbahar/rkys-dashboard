import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * lib/qr/token.ts'teki hashToken deseniyle aynı — ham anahtar asla saklanmaz,
 * yalnızca hash'i (api_keys.key_hash). "rkys_live_" öneki (key_prefix)
 * yaygın API key konvansiyonu (Stripe vb.) — kullanıcı listede hangi
 * anahtarın hangisi olduğunu son 4 karakterle ayırt edebilsin diye saklanır,
 * güvenlik hash'e dayanır.
 */
export function generateApiKey(): { rawKey: string; keyPrefix: string } {
  const rawKey = `rkys_live_${randomBytes(24).toString("base64url")}`;
  return { rawKey, keyPrefix: rawKey.slice(-4) };
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}
