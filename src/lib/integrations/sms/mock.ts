import "server-only";

import { randomUUID } from "crypto";

import { createServiceRoleClient } from "@/lib/supabase/server";

import type { SendSmsParams, SendSmsResult, SmsProvider } from "./provider";

// lib/email/mock.ts ile aynı gerekçe: gerçekten göndermez, yalnızca
// sent_sms'e kaydeder (body dahil — OTP akışının testlerin/geliştiricinin
// kodu görebilmesi gerekir, sent_emails'in aksine).
export const mockSmsProvider: SmsProvider = {
  name: "mock",

  async sendSms(params: SendSmsParams): Promise<SendSmsResult> {
    const messageId = `mock-sms-${randomUUID()}`;
    const service = createServiceRoleClient();
    await service.from("sent_sms").insert({
      tenant_id: params.tenantId,
      phone: params.phone,
      body: params.body,
      provider: "mock",
    });
    return { messageId };
  },
};
