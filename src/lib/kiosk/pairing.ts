import { randomBytes } from "node:crypto";

// Personelin tablet tarayıcısına elle yazacağı kısa kod — pickup_code (0061)
// ile aynı okunabilirlik hedefi, tahmin edilebilirlik pickup_code kadar
// önemli değil (cihaz eşleme, ödeme/kimlik doğrulama sırrı değil).
export function generatePairingCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}
