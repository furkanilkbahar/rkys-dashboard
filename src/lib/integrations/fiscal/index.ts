import "server-only";

import { mockFiscalProvider } from "./mock";
import type { FiscalDeviceProvider } from "./provider";

export type { FiscalDeviceProvider, FiscalReceiptInput, FiscalReceiptResult, VoidFiscalReceiptInput } from "./provider";

/**
 * Henüz seçilmiş gerçek bir ÖKC sağlayıcısı yok (D61) — somut bir model
 * seçildiğinde payments/index.ts'teki getDefaultPaymentProvider deseniyle
 * aynı şekilde env değişkenine göre seçim yapılacak.
 */
export function getFiscalProvider(): FiscalDeviceProvider {
  return mockFiscalProvider;
}
