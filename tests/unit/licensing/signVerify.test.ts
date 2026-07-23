import { beforeAll, describe, expect, it } from "vitest";

import { signLicense } from "@/lib/licensing/sign";
import type { LicensePayload } from "@/lib/licensing/types";
import { resolveLicenseGateRedirect, verifyLicense } from "@/lib/licensing/verify";

// Sabit lokal demo anahtarı — verify.ts'e gömülü public key'in eşi (gizli
// değil, .env.ci'de de aynı değer committed — mock.ts'deki sağlayıcı
// sırlarıyla aynı gerekçe).
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIMo6FNTzRUoniMObbUj+/3bPMYL/E/W7AXtmL17Gvfaq
-----END PRIVATE KEY-----`;

beforeAll(() => {
  process.env.LICENSE_SIGNING_PRIVATE_KEY = TEST_PRIVATE_KEY;
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

    const result = verifyLicense(licenseKey);
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

    const result = verifyLicense(tampered);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid_signature");
    }
    expect(payloadB64).not.toBe(tamperedPayload);
  });

  it("bozuk formatlı (nokta ayracı yok) bir lisans reddedilir", () => {
    const result = verifyLicense("not-a-valid-license-string");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid_format");
    }
  });

  it("süresi geçmiş bir self_hosted lisans reddedilir", () => {
    const licenseKey = signLicense(
      makePayload({ licenseType: "self_hosted", expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() }),
    );

    const result = verifyLicense(licenseKey);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("expired");
    }
  });

  it("expiresAt gelecekteyse self_hosted lisans geçerli kabul edilir", () => {
    const licenseKey = signLicense(
      makePayload({ licenseType: "self_hosted", expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }),
    );

    const result = verifyLicense(licenseKey);
    expect(result.valid).toBe(true);
  });
});

describe("resolveLicenseGateRedirect (Faz 6 Adım 4, S29 — self-hosted lisans kapısı)", () => {
  it("LICENSE_KEY set edilmemişse (SaaS/cloud) kapı hiç devreye girmez", () => {
    expect(resolveLicenseGateRedirect(undefined)).toBeNull();
  });

  it("geçerli bir self_hosted lisansı olan kurulumda kapı açıktır", () => {
    const licenseKey = signLicense(makePayload({ licenseType: "self_hosted" }));
    expect(resolveLicenseGateRedirect(licenseKey)).toBeNull();
  });

  it("geçersiz format için license-invalid'e sebep parametresiyle yönlendirir", () => {
    expect(resolveLicenseGateRedirect("not-a-valid-license-string")).toBe("/admin/license-invalid?reason=invalid_format");
  });

  it("süresi dolmuş lisans için license-invalid'e sebep parametresiyle yönlendirir", () => {
    const licenseKey = signLicense(
      makePayload({ licenseType: "self_hosted", expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() }),
    );
    expect(resolveLicenseGateRedirect(licenseKey)).toBe("/admin/license-invalid?reason=expired");
  });
});
