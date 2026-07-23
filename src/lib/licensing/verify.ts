import "server-only";

import { createPublicKey, verify as cryptoVerify } from "crypto";

import type { LicensePayload } from "./types";

// Self-hosted dağıtım imajına gömülecek public key — gizli değil (kullanıcı
// kararı: tamamen offline doğrulama, ağ çağrısı yok). Bu dosya kasıtlı
// olarak DB/Supabase'e hiç bağımlı değil — self-hosted tarafta tek başına
// (bu proje deposundan) taşınabilir olması gerekiyor.
const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAmFXE2KN6s4wkXo31d6Erw0i3UHFOGX8VmhjeGFZncZA=
-----END PUBLIC KEY-----`;

export type LicenseVerificationResult =
  | { valid: true; payload: LicensePayload }
  | { valid: false; reason: "invalid_format" | "invalid_signature" | "expired" };

export function verifyLicense(licenseKey: string): LicenseVerificationResult {
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

  const publicKey = createPublicKey(LICENSE_PUBLIC_KEY_PEM);
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
export function resolveLicenseGateRedirect(licenseKey: string | undefined): string | null {
  if (!licenseKey) {
    return null;
  }
  const result = verifyLicense(licenseKey);
  if (result.valid) {
    return null;
  }
  return `/admin/license-invalid?reason=${result.reason}`;
}
