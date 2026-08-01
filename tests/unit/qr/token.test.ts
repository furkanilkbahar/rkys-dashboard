import { randomBytes } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { decryptToken, encryptToken, generateRawToken, hashToken } from "@/lib/qr/token";

describe("QR token şifreleme (bug-hunt 2026-08-01, D86 — 'QR göster')", () => {
  describe("QR_TOKEN_ENCRYPTION_KEY ayarlıyken", () => {
    beforeAll(() => {
      process.env.QR_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    });

    it("bir token şifrelenip aynen çözülebilir", () => {
      const raw = generateRawToken();
      const encrypted = encryptToken(raw);
      expect(encrypted).not.toBeNull();
      expect(decryptToken(encrypted!)).toBe(raw);
    });

    it("her şifreleme rastgele IV yüzünden farklı çıktı üretir", () => {
      const raw = generateRawToken();
      expect(encryptToken(raw)).not.toBe(encryptToken(raw));
    });

    it("hash hesaplama şifrelemeden bağımsız, deterministik kalır", () => {
      const raw = generateRawToken();
      expect(hashToken(raw)).toBe(hashToken(raw));
    });

    // Regresyon (bug-hunt sonrası, 2026-08-01): bu test önceden encryptToken'ın
    // bozuk anahtarda HATA FIRLATMASINI bekliyordu — bu, gerçek kullanıcı
    // raporuyla ortaya çıkan asıl bug'dı: bozuk/yanlış uzunlukta bir anahtar
    // (ör. .env.local'e kopyala/yapıştır hatası) tüm createTable/
    // regenerateTableQr action'ını çökertip "Kaydedilemedi" hatasına yol
    // açıyordu — yalnızca QR göster değil, TEMEL masa oluşturma bile kırılmıştı.
    // Doğru davranış: sessizce null dönüp teknik detayı log'a düşürmek.
    it("32 bayta çözülmeyen bir anahtarda ÇÖKMEDEN null döner (oluşturma/yenileme akışını bozmaz)", () => {
      process.env.QR_TOKEN_ENCRYPTION_KEY = Buffer.from("kisa-anahtar").toString("base64");
      expect(() => encryptToken(generateRawToken())).not.toThrow();
      expect(encryptToken(generateRawToken())).toBeNull();
    });
  });

  describe("QR_TOKEN_ENCRYPTION_KEY ayarlı değilken", () => {
    beforeAll(() => {
      delete process.env.QR_TOKEN_ENCRYPTION_KEY;
    });

    it("encryptToken null döner (mevcut oluşturma/yenileme akışı bozulmaz)", () => {
      expect(encryptToken(generateRawToken())).toBeNull();
    });

    it("decryptToken null döner", () => {
      expect(decryptToken("herhangi-bir-deger")).toBeNull();
    });
  });
});
