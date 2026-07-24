// Sağlayıcı-agnostik muhasebe senkronizasyon arayüzü (D61) — Paraşüt ilk
// hedef, ama arayüz herhangi bir muhasebe programına karşı yeni bir adaptör
// (mock.ts örneği) olarak eklenebilir. lib/payments/provider.ts ile aynı
// desen (ARCHITECTURE.md #4).

export type OrderInvoiceInput = {
  orderId: string;
  subtotalMinor: number;
  currency: string;
  createdAt: string;
};

export type SyncInvoiceResult = {
  externalRef: string;
};

export interface AccountingProvider {
  readonly name: string;
  syncOrderInvoice(input: OrderInvoiceInput): Promise<SyncInvoiceResult>;
}
