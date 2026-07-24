import "server-only";

import { mockAccountingProvider } from "./mock";
import type { AccountingProvider } from "./provider";

export type { AccountingProvider, OrderInvoiceInput, SyncInvoiceResult } from "./provider";

/**
 * Varsayılan sağlayıcı: gerçek Paraşüt entegrasyonu D61'de Faz 10'a
 * ertelendi ama somut sağlayıcı seçimi kullanıcı gündeme getirmedi —
 * lib/payments/index.ts'teki isConfigured deseninin aksine burada henüz
 * bir "gerçek sağlayıcı" yok, yalnızca mock var.
 */
export function getDefaultAccountingProvider(): AccountingProvider {
  return mockAccountingProvider;
}
