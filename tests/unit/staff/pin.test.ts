import { afterEach, describe, expect, it } from "vitest";

import { decryptPin, encryptPin, generatePinCandidate } from "@/lib/staff/pin";

const KEY = Buffer.alloc(32, 7).toString("base64");

afterEach(() => {
  delete process.env.STAFF_PIN_ENCRYPTION_KEY;
});

describe("staff PIN şifreleme (D102)", () => {
  it("şifrelenen PIN geri çözülür ve ciphertext ham PIN'i içermez", () => {
    process.env.STAFF_PIN_ENCRYPTION_KEY = KEY;

    const encrypted = encryptPin("4821");

    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toContain("4821");
    expect(decryptPin(encrypted!)).toBe("4821");
  });

  it("aynı PIN her seferinde farklı ciphertext üretir (rastgele IV)", () => {
    process.env.STAFF_PIN_ENCRYPTION_KEY = KEY;

    expect(encryptPin("4821")).not.toBe(encryptPin("4821"));
  });

  it("anahtar yoksa şifreleme atlanır — akış kırılmaz, sadece özellik yok", () => {
    expect(encryptPin("4821")).toBeNull();
  });

  it("anahtar bozuksa (32 bayt değil) throw etmez, null döner", () => {
    // d15a26d: bozuk QR anahtarı throw ettiği için tüm masa oluşturma akışı
    // çökmüştü. Aynı hatayı PIN tarafında üretmediğimizi sabitler.
    process.env.STAFF_PIN_ENCRYPTION_KEY = Buffer.alloc(16, 7).toString("base64");

    expect(encryptPin("4821")).toBeNull();
  });

  it("başka bir anahtarla çözülemez (auth tag) ve çökmez", () => {
    process.env.STAFF_PIN_ENCRYPTION_KEY = KEY;
    const encrypted = encryptPin("4821")!;

    process.env.STAFF_PIN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");

    expect(decryptPin(encrypted)).toBeNull();
  });

  it("üretilen aday her zaman 4 haneli rakamdır", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generatePinCandidate()).toMatch(/^[0-9]{4}$/);
    }
  });
});
