import "server-only";

import type { EmailProvider, SendEmailParams, SendEmailResult } from "./provider";

// NOT: kullanıcının henüz Resend API anahtarı yok. Bu adaptör Resend'in
// kamuya açık REST API deseni (POST https://api.resend.com/emails, Bearer
// auth, base64 attachment) referans alınarak yazıldı ama gerçek API'ye karşı
// DOĞRULANMADI — lib/payments/iyzico.ts ile aynı durum. Anahtar sağlandığında
// ayrı bir oturumda uçtan uca test edilmesi gerekiyor. RESEND_API_KEY env'de
// yoksa getDefaultEmailProvider() (index.ts) bu adaptörü hiç seçmez.
const API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "raporlar@rkys-dashboard.com";

export function isResendConfigured(): boolean {
  return Boolean(API_KEY);
}

export const resendEmailProvider: EmailProvider = {
  name: "resend",

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    if (!API_KEY) {
      throw new Error("resend is not configured");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: params.to,
        subject: params.subject,
        text: params.text,
        attachments: params.attachment
          ? [{ filename: params.attachment.filename, content: params.attachment.content.toString("base64") }]
          : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`resend sendEmail failed: ${response.status}`);
    }

    const data = (await response.json()) as { id: string };
    return { messageId: data.id };
  },
};
