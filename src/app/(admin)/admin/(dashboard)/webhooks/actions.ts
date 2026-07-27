"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentActor } from "@/lib/auth/session";
import { isEnabled } from "@/lib/modules/isEnabled";
import { createClient } from "@/lib/supabase/server";
import { generateWebhookSecret } from "@/lib/webhooks/secret";
import { webhookFormSchema, type WebhookActionResult } from "@/lib/webhooks/schemas";

export async function createWebhook(input: unknown): Promise<WebhookActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (actor.role !== "owner") return { ok: false, error: "forbidden" };
  if (!(await isEnabled(actor.tenantId, "api_access"))) return { ok: false, error: "not_enabled" };

  const parsed = webhookFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.from("webhooks").insert({
    tenant_id: actor.tenantId,
    url: parsed.data.url,
    secret: generateWebhookSecret(),
    event_types: parsed.data.eventTypes,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/webhooks");
  return { ok: true };
}

export async function toggleWebhook(webhookId: string, isActive: boolean): Promise<WebhookActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (actor.role !== "owner") return { ok: false, error: "forbidden" };
  if (!z.uuid().safeParse(webhookId).success) return { ok: false, error: "unknown" };

  const supabase = await createClient();
  const { error } = await supabase.from("webhooks").update({ is_active: isActive }).eq("id", webhookId).eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/webhooks");
  return { ok: true };
}
