// ÖKC (Yeni Nesil Ödeme Kaydedici Cihaz) adaptör KAPISI — D61: "ÖKC adaptör
// kapısı mimaride" kararı yalnızca bu arayüzün ve genişleme noktasının
// dokümante edilmesini kapsar (PLAN.md Faz 10). GERÇEK bir implementasyon
// (mock dahil) YOK: fiskal cihaz entegrasyonu gerçek donanım/GİB
// sertifikasyonu gerektirir, bu proje kapsamında test edilemez.
//
// Gelecekte bir FiscalDeviceProvider eklendiğinde (kullanıcı somut bir ÖKC
// modeli/servis sağlayıcısı seçtiğinde), lib/payments/provider.ts'teki
// PaymentProvider deseniyle aynı şekilde kayıt edilir: her ödeme
// tamamlandığında (record_payment RPC'sinin çağrıldığı admin/kasa akışı,
// bkz. supabase/migrations/0049_item_level_split.sql) bu arayüz üzerinden
// fiskal fiş kesilir.
export type FiscalReceiptInput = {
  orderId: string;
  totalMinor: number;
  currency: string;
};

export type FiscalReceiptResult = {
  fiscalReceiptRef: string;
};

export interface FiscalDeviceProvider {
  readonly name: string;
  printFiscalReceipt(input: FiscalReceiptInput): Promise<FiscalReceiptResult>;
}
