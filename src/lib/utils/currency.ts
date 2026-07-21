// Kuruş/cent (minor unit) → tenant'ın kendi para birimine göre biçimlendirilmiş
// gösterim (S16: çok dilli menü + para birimi biçimi). Locale sabit "tr-TR"
// kalır — ayraç/basamak biçimi için, para birimi sembolü `currency`'den gelir.
export function formatPrice(priceMinor: number, currency: string): string {
  return (priceMinor / 100).toLocaleString("tr-TR", { style: "currency", currency });
}
