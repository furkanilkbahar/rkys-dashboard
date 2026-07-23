// Sağlayıcı-agnostik e-posta arayüzü — lib/payments/provider.ts ile aynı
// desen (ARCHITECTURE.md #4 adaptör mimarisi). tenantId, sağlayıcının kendisi
// için değil, mock.ts'in sent_emails'e hangi tenant adına yazacağını bilmesi
// için taşınır.
export type SendEmailAttachment = { filename: string; content: Buffer; contentType: string };

export type SendEmailParams = {
  tenantId: string;
  to: string;
  subject: string;
  text: string;
  attachment?: SendEmailAttachment;
};

export type SendEmailResult = { messageId: string };

export interface EmailProvider {
  readonly name: string;
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;
}
