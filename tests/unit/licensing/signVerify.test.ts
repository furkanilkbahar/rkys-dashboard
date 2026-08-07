import { generateKeyPairSync } from "crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { signLicense } from "@/lib/licensing/sign";
import type { LicensePayload } from "@/lib/licensing/types";
import { resolveLicenseGateRedirect, verifyLicense } from "@/lib/licensing/verify";

// Her koşumda ÜRETİLEN geçici anahtar çifti — repo'da imzalama anahtarı
// tutulmaz.
//
// Eskiden burada sabit bir private key duruyordu ve yorumu "gizli değil"
// diyordu. Yanlıştı: o anahtar verify.ts'e gömülü public key'in birebir eşiydi,
// yani repo'ya erişen herkes geçerli lifetime lisans üretebilirdi (2026-08-08,
// repo public yapılmadan hemen önce yakalandı). Kök sebep testin şekliydi —
// uçtan uca imzala-doğrula ancak gerçek anahtarla yazılabiliyordu. verifyLicense
// artık public key'i parametre olarak kabul ediyor, test de kendi çiftini
// üretiyor: doğrulanan davranış aynı, sızacak sır yok.
let testPublicKeyPem: string;

beforeAll(() => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  process.env.LICENSE_SIGNING_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  testPublicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
});

function makePayload(overrides: Partial<LicensePayload> = {}): LicensePayload {
  return {
    tenantId: "00000000-0000-4000-8000-000000000001",
    licenseType: "lifetime",
    issuedAt: new Date().toISOString(),
    expiresAt: null,
    ...overrides,
  };
}

describe("lisans imzalama/doğrulama (Faz 4 Adım 4)", () => {
  it("imzalı bir lisans doğru public key ile doğrulanır", () => {
    const payload = makePayload();
    const licenseKey = signLicense(payload);

    const result = verifyLicense(licenseKey, testPublicKeyPem);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload).toEqual(payload);
    }
  });

  it("payload'ı değiştirilmiş (imza uyuşmayan) bir lisans reddedilir", () => {
    const licenseKey = signLicense(makePayload());
    const [payloadB64, signatureB64] = licenseKey.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify(makePayload({ licenseType: "self_hosted" }))).toString("base64url");
    const tampered = `${tamperedPayload}.${signatureB64}`;

    const result = verifyLicense(tampered, testPublicKeyPem);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid_signature");
    }
    expect(payloadB64).not.toBe(tamperedPayload);
  });

  it("bozuk formatlı (nokta ayracı yok) bir lisans reddedilir", () => {
    const result = verifyLicense("not-a-valid-license-string", testPublicKeyPem);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid_format");
    }
  });

  it("süresi geçmiş bir self_hosted lisans reddedilir", () => {
    const licenseKey = signLicense(
      makePayload({ licenseType: "self_hosted", expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() }),
    );

    const result = verifyLicense(licenseKey, testPublicKeyPem);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("expired");
    }
  });

  it("expiresAt gelecekteyse self_hosted lisans geçerli kabul edilir", () => {
    const licenseKey = signLicense(
      makePayload({ licenseType: "self_hosted", expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }),
    );

    const result = verifyLicense(licenseKey, testPublicKeyPem);
    expect(result.valid).toBe(true);
  });
});

describe("resolveLicenseGateRedirect (Faz 6 Adım 4, S29 — self-hosted lisans kapısı)", () => {
  it("LICENSE_KEY set edilmemişse (SaaS/cloud) kapı hiç devreye girmez", () => {
    expect(resolveLicenseGateRedirect(undefined)).toBeNull();
  });

  it("geçerli bir self_hosted lisansı olan kurulumda kapı açıktır", () => {
    const licenseKey = signLicense(makePayload({ licenseType: "self_hosted" }));
    expect(resolveLicenseGateRedirect(licenseKey, testPublicKeyPem)).toBeNull();
  });

  it("BAŞKA bir anahtarla imzalanmış lisans gömülü public key ile geçmez", () => {
    // Anahtar döndürme (2026-08-08) tam olarak bunun için: sızmış eski
    // anahtarla üretilen bir lisans, gömülü YENİ public key'e karşı
    // doğrulanamaz. Burada testin geçici çifti "yabancı anahtar" rolünde —
    // varsayılan (üretim) public key'e karşı reddedilmeli.
    const licenseKey = signLicense(makePayload({ licenseType: "self_hosted" }));
    expect(resolveLicenseGateRedirect(licenseKey)).toBe("/admin/license-invalid?reason=invalid_signature");
  });

  it("geçersiz format için license-invalid'e sebep parametresiyle yönlendirir", () => {
    expect(resolveLicenseGateRedirect("not-a-valid-license-string")).toBe("/admin/license-invalid?reason=invalid_format");
  });

  it("süresi dolmuş lisans için license-invalid'e sebep parametresiyle yönlendirir", () => {
    const licenseKey = signLicense(
      makePayload({ licenseType: "self_hosted", expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() }),
    );
    expect(resolveLicenseGateRedirect(licenseKey, testPublicKeyPem)).toBe("/admin/license-invalid?reason=expired");
  });
});
