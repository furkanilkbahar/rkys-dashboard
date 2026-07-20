"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const advanceSchema = z.object({
  id: z.uuid(),
  toStatus: z.enum(["preparing", "ready", "served"]),
});

export async function advanceOrder(input: { id: string; toStatus: string }): Promise<{ ok: boolean }> {
  const parsed = advanceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("advance_order_status", {
    p_order_id: parsed.data.id,
    p_to_status: parsed.data.toStatus,
  });
  return { ok: !error };
}
