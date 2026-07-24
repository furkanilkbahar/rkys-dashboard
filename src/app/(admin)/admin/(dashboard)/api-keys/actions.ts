"use server";

import { revalidatePath } from "next/cache";

import { generateApiKey, hashApiKey } from "@/lib/api/keys";
import { apiKeyFormSchema, type ApiKeyActionResult, type RevokeApiKeyResult } from "@/lib/api/schemas";
import { getCurrentActor } from "@/lib/auth/session";
import { isEnabled } from "@/lib/modules/isEnabled";
import { createClient } from "@/lib/supabase/server";

export async function createApiKey(input: unknown): Promise<ApiKeyActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (!(await isEnabled(actor.tenantId, "api_access"))) return { ok: false, error: "not_enabled" };

  const parsed = apiKeyFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const { rawKey, keyPrefix } = generateApiKey();
  const supabase = await createClient();
  const { error } = await supabase.from("api_keys").insert({
    tenant_id: actor.tenantId,
    name: parsed.data.name,
    key_hash: hashApiKey(rawKey),
    key_prefix: keyPrefix,
    created_by: actor.userId,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/api-keys");
  return { ok: true, rawKey };
}

export async function revokeApiKey(keyId: string): Promise<RevokeApiKeyResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.from("api_keys").update({ is_active: false }).eq("id", keyId).eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/api-keys");
  return { ok: true };
}
