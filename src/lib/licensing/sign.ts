import "server-only";

import { createPrivateKey, sign as cryptoSign } from "crypto";

import type { LicensePayload } from "./types";

// Private key yalnızca platformda (bu env değişkeninde) yaşar — self-hosted
// dağıtıma hiç gönderilmez, yalnızca eşleşen public key (verify.ts) gömülür.
function getPrivateKey() {
  const pem = process.env.LICENSE_SIGNING_PRIVATE_KEY;
  if (!pem) {
    throw new Error("LICENSE_SIGNING_PRIVATE_KEY is not configured");
  }
  return createPrivateKey(pem);
}

/**
 * payload.payload (base64url) + "." + imza (base64url) — self-hosted taraf
 * ağa hiç çıkmadan (kullanıcı kararı) verify.ts ile bunu tek başına
 * doğrulayabilsin diye JWT'ye benzer, bağımsız/taşınabilir bir format.
 */
export function signLicense(payload: LicensePayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = cryptoSign(null, Buffer.from(payloadB64), getPrivateKey());
  return `${payloadB64}.${signature.toString("base64url")}`;
}
