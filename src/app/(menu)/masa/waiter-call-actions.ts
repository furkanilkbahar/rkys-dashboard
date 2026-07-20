"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const callWaiterSchema = z.object({
  callTypeKey: z.string().max(50).nullable(),
});

export async function callWaiter(input: { callTypeKey: string | null }): Promise<{ ok: boolean; error?: string }> {
  const parsed = callWaiterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("call_waiter", {
    p_call_type_key: parsed.data.callTypeKey ?? undefined,
  });

  if (error) {
    return { ok: false, error: error.message.startsWith("RATE_LIMITED") ? "rate_limited" : "unknown" };
  }
  return { ok: true };
}
