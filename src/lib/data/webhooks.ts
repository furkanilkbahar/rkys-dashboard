import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { WebhookEventType } from "@/lib/webhooks/schemas";

export type AdminWebhook = { id: string; url: string; secret: string; eventTypes: WebhookEventType[]; isActive: boolean };

export async function getAdminWebhooks(tenantId: string): Promise<AdminWebhook[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("webhooks")
    .select("id, url, secret, event_types, is_active")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((w) => ({
    id: w.id,
    url: w.url,
    secret: w.secret,
    eventTypes: w.event_types as WebhookEventType[],
    isActive: w.is_active,
  }));
}

export type AdminWebhookDelivery = {
  id: string;
  eventType: string;
  status: "pending" | "sent" | "delivered" | "failed";
  attemptCount: number;
  createdAt: string;
};

export async function getWebhookDeliveries(tenantId: string, webhookId: string, limit = 20): Promise<AdminWebhookDelivery[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("webhook_deliveries")
    .select("id, event_type, status, attempt_count, created_at")
    .eq("tenant_id", tenantId)
    .eq("webhook_id", webhookId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((d) => ({
    id: d.id,
    eventType: d.event_type,
    status: d.status as AdminWebhookDelivery["status"],
    attemptCount: d.attempt_count,
    createdAt: d.created_at,
  }));
}
