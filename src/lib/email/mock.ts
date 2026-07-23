import "server-only";

import { randomUUID } from "crypto";

import { createServiceRoleClient } from "@/lib/supabase/server";

import type { EmailProvider, SendEmailParams, SendEmailResult } from "./provider";

// lib/payments/mock.ts'deki gerekçeyle aynı: gerçekten göndermez, yalnızca
// sent_emails'e kaydeder — mock.ts service-role client kullanır çünkü
// çağıran taraf (scheduledDigest.ts) request-scope'lu bir Supabase client'a
// sahip olmayan bir cron/internal-route bağlamında çalışabilir.
export const mockEmailProvider: EmailProvider = {
  name: "mock",

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const messageId = `mock-email-${randomUUID()}`;
    const service = createServiceRoleClient();
    await service.from("sent_emails").insert({
      tenant_id: params.tenantId,
      to_email: params.to,
      subject: params.subject,
      provider: "mock",
      has_attachment: Boolean(params.attachment),
    });
    return { messageId };
  },
};
