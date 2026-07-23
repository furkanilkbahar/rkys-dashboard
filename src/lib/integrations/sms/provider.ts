// Sağlayıcı-agnostik SMS arayüzü — lib/payments/provider.ts ile aynı desen
// (ARCHITECTURE.md #4). Somut sağlayıcı (Twilio vb.) seçimi D66 ile Faz 12'ye
// kadar ertelenebilir; bu arayüz o seçim yapılana kadar tek sağlayıcı olan
// mock.ts'nin üzerine kurulu.

export type SendSmsParams = {
  tenantId: string;
  phone: string;
  body: string;
};

export type SendSmsResult = {
  messageId: string;
};

export interface SmsProvider {
  readonly name: string;
  sendSms(params: SendSmsParams): Promise<SendSmsResult>;
}
