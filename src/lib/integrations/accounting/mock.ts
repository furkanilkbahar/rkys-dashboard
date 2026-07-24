import type { AccountingProvider, OrderInvoiceInput, SyncInvoiceResult } from "./provider";

// Gerçek Paraşüt kimlik bilgileri henüz yok (D61) — yerel/test ortamında ve
// sağlayıcı seçimi netleşene kadar varsayılan bu mock çalışır (payments/
// mock.ts, lib/integrations/sms/mock.ts ile aynı mock-first yaklaşım).
export const mockAccountingProvider: AccountingProvider = {
  name: "mock",
  async syncOrderInvoice(input: OrderInvoiceInput): Promise<SyncInvoiceResult> {
    return { externalRef: `mock-inv-${input.orderId.slice(0, 8)}` };
  },
};
