import "server-only";

import { mockSmsProvider } from "./mock";
import type { SmsProvider } from "./provider";

export type { SendSmsParams, SendSmsResult, SmsProvider } from "./provider";

/**
 * D66: somut sağlayıcı seçimi (Twilio vb.) kullanıcı gündeme getirdiğinde
 * yapılır — şimdilik tek sağlayıcı mock (lib/payments/index.ts'teki
 * getDefaultPaymentProvider ile aynı desen, ama şu an dallanacak ikinci bir
 * sağlayıcı yok).
 */
export function getDefaultSmsProvider(): SmsProvider {
  return mockSmsProvider;
}
