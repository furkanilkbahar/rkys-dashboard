import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, randomInt } from "node:crypto";

/**
 * D102: "PIN Göster". Doğrulama hâlâ `profiles.pin_hash` (bcrypt, RULES #29)
 * üzerinden yürür — buradaki şifreli kopya onun YERİNE değil, EK olarak
 * saklanır (bkz. staff_pin_secrets, 0094). Desen D86'daki QR token'ıyla
 * birebir aynı (lib/qr/token.ts): AES-256-GCM, `iv | authTag | ciphertext`
 * base64.
 *
 * Anahtar yoksa YA DA bozuksa (yanlış uzunluk — kopyala/yapıştır hatası vb.)
 * şifreleme sessizce atlanır ve teknik detay log'a düşer. Bu bilinçli: PIN
 * atama akışı bu özellik olmadan da çalışmalı. QR tarafında bozuk anahtarda
 * throw edilmesi tüm masa oluşturma/yenileme akışını kırmıştı (d15a26d).
 */
function getEncryptionKey(): Buffer | null {
  const raw = process.env.STAFF_PIN_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    console.error(`STAFF_PIN_ENCRYPTION_KEY must decode to exactly 32 bytes (base64), got ${key.length}`);
    return null;
  }
  return key;
}

export function encryptPin(rawPin: string): string | null {
  const key = getEncryptionKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(rawPin, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptPin(encrypted: string): string | null {
  const key = getEncryptionKey();
  if (!key) return null;
  try {
    const buf = Buffer.from(encrypted, "base64");
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (error) {
    // Anahtar döndürülmüş ya da satır bozulmuşsa auth tag doğrulaması patlar.
    // "Gösterilemedi" demek, çökmekten iyidir (arayüz not_found'a düşer).
    console.error("decryptPin failed", error);
    return null;
  }
}

/**
 * Çakışmayan PIN'i RPC'nin kendisi (reset_staff_pin, 0071) belirler; burası
 * yalnızca adayı üretir. 4 hane: personel bunu kasa/mutfak ekranında elle
 * giriyor, uzunluğu artırmak sahada yazım hatasına dönüşüyor.
 */
export function generatePinCandidate(): string {
  // randomInt reddetme yöntemiyle çalışır — `randomBytes % 10000` düşük
  // değerleri hafifçe daha olası kılardı (2^32, 10000'e tam bölünmüyor).
  return randomInt(0, 10000).toString().padStart(4, "0");
}
