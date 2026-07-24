import { z } from "zod";

export const WEBHOOK_EVENT_TYPES = ["order.created", "order.status_changed"] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

// next-intl t() noktaları iç içe yol ayracı sayar (namespace.key.alt-key) —
// olay tipi değerleri (DB'de/webhook header'ında "order.created" gibi
// noktalı kalır, bu yaygın webhook adlandırma kuralı) doğrudan t() yoluna
// enjekte edilemez. Görüntüleme için düz (noktasız) anahtarlara eşlenir.
export const WEBHOOK_EVENT_TYPE_LABEL_KEYS: Record<WebhookEventType, string> = {
  "order.created": "orderCreated",
  "order.status_changed": "orderStatusChanged",
};

export const webhookFormSchema = z.object({
  url: z.url(),
  eventTypes: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1, "required"),
});
export type WebhookFormInput = z.infer<typeof webhookFormSchema>;

export type WebhookActionResult = { ok: true } | { ok: false; error: "invalid_input" | "forbidden" | "not_enabled" | "unknown" };
