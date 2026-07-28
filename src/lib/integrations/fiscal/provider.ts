// ÖKC (Yeni Nesil Ödeme Kaydedici Cihaz) adaptör kapısı. D61 kararı
// başlangıçta yalnızca bu arayüzün dokümante edilmesini öngörmüştü (gerçek
// donanım/GİB sertifikasyonu bu proje kapsamında alınamadığı için test
// edilemeyeceği gerekçesiyle) — Faz 17'de kullanıcı onayıyla
// payments/subscriptions'taki mock-first desene genişletildi (bkz.
// DECISIONS.md D84, ARCHITECTURE.md D61 güncellemesi). mock.ts bu yüzden
// artık var; gerçek bir ÖKC modeli/servis sağlayıcısı seçildiğinde
// iyzico.ts ile aynı şekilde yeni bir adaptör eklenir.
export type FiscalReceiptInput = {
  paymentId: string;
  totalMinor: number;
  currency: string;
};

export type FiscalReceiptResult = {
  fiscalReceiptRef: string;
};

export type VoidFiscalReceiptInput = {
  fiscalReceiptRef: string;
};

export interface FiscalDeviceProvider {
  readonly name: string;
  printFiscalReceipt(input: FiscalReceiptInput): Promise<FiscalReceiptResult>;
  voidFiscalReceipt(input: VoidFiscalReceiptInput): Promise<void>;
}
