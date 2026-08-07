import "server-only";

import { createPublicKey, verify as cryptoVerify } from "crypto";

import type { LicensePayload } from "./types";

// Self-hosted dağıtım imajına gömülecek public key — gizli değil (kullanıcı
// kararı: tamamen offline doğrulama, ağ çağrısı yok). Bu dosya kasıtlı
// olarak DB/Supabase'e hiç bağımlı değil — self-hosted tarafta tek başına
// (bu proje deposundan) taşınabilir olması gerekiyor.
//
// ANAHTAR DÖNDÜRÜLDÜ (2026-08-08): önceki çiftin PRIVATE tarafı `.env.ci`
// içinde commit'liydi ve buradaki public key'in birebir eşiydi — yani repo'ya
// erişebilen herkes geçerli lifetime/self-hosted lisans üretebilirdi. Repo
// public yapılmadan önce fark edildi. Yeni private key repo'ya HİÇ girmez,
// yalnızca dağıtım ortamının secret'ında yaşar (Vercel env / GitHub secret).
const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEABkttblJ2QvqKYd+R/8PLzP+DGY09rfNrRzKw7Np9JpA=
-----END PUBLIC KEY-----`;

export type LicenseVerificationResult =
  | { valid: true; payload: LicensePayload }
  | { valid: false; reason: "invalid_format" | "invalid_signature" | "expired" };

/**
 * @param publicKeyPem Yalnızca test içindir. Üretimde HİÇBİR ZAMAN geçilmez —
 * varsayılan, yukarıdaki gömülü anahtardır. Bu parametre olmasaydı uçtan uca
 * imzala-doğrula testi ancak gerçek private key'i repo'ya koyarak yazılabilirdi
 * (eski kurulumun tam olarak bu yüzden sızdırdığı anahtar). Artık test kendi
 * geçici çiftini üretiyor ve repo'da imzalama anahtarı tutulmuyor.
 */
export function verifyLicense(
  licenseKey: string,
  publicKeyPem: string = LICENSE_PUBLIC_KEY_PEM,
): LicenseVerificationResult {
  const parts = licenseKey.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "invalid_format" };
  }
  const [payloadB64, signatureB64] = parts;

  let payload: LicensePayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { valid: false, reason: "invalid_format" };
  }

  const publicKey = createPublicKey(publicKeyPem);
  const signatureValid = cryptoVerify(null, Buffer.from(payloadB64), publicKey, Buffer.from(signatureB64, "base64url"));
  if (!signatureValid) {
    return { valid: false, reason: "invalid_signature" };
  }

  if (payload.expiresAt && new Date(payload.expiresAt).getTime() < Date.now()) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, payload };
}

/**
 * Self-hosted dağıtımlarda (dashboard) layout'unun kullandığı kapı: yalnızca
 * LICENSE_KEY set edilmişse (self-hosted imajı) devreye girer — SaaS/cloud
 * tenant'ları bu env var'ı hiç set etmediği için her zaman null döner.
 * Saf fonksiyon olarak ayrıldı: Next.js layout'undan bağımsız test edilebilir.
 */
/** @param publicKeyPem Yalnızca test içindir — bkz. `verifyLicense`. */
export function resolveLicenseGateRedirect(
  licenseKey: string | undefined,
  publicKeyPem?: string,
): string | null {
  if (!licenseKey) {
    return null;
  }
  const result = verifyLicense(licenseKey, publicKeyPem);
  if (result.valid) {
    return null;
  }
  return `/admin/license-invalid?reason=${result.reason}`;
}
