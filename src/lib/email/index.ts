import "server-only";

import { mockEmailProvider } from "./mock";
import type { EmailProvider } from "./provider";
import { isResendConfigured, resendEmailProvider } from "./resend";

export type { EmailProvider, SendEmailAttachment, SendEmailParams, SendEmailResult } from "./provider";

/**
 * Varsayılan sağlayıcı: RESEND_API_KEY env'de varsa Resend, yoksa (henüz
 * anahtar yok) mock — lib/payments/index.ts'teki getDefaultPaymentProvider
 * ile aynı desen.
 */
export function getDefaultEmailProvider(): EmailProvider {
  return isResendConfigured() ? resendEmailProvider : mockEmailProvider;
}
