"use server";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import { buildLoyaltyConfig, loyaltyProgramFormSchema, type LoyaltyActionResult } from "@/lib/loyalty/schemas";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

async function requireStaffActor() {
  return getCurrentActor();
}

export async function updateLoyaltyProgram(input: unknown): Promise<LoyaltyActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = loyaltyProgramFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.from("loyalty_programs").upsert(
    {
      tenant_id: actor.tenantId,
      mode: parsed.data.mode,
      config: buildLoyaltyConfig(parsed.data) as Json,
      is_active: parsed.data.isActive,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/loyalty");
  return { ok: true };
}
