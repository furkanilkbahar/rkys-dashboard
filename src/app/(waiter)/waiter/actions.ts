"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const idSchema = z.object({ id: z.uuid() });

export async function acknowledgeCall(input: { id: string }): Promise<{ ok: boolean }> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("acknowledge_waiter_call", { p_call_id: parsed.data.id });
  return { ok: !error };
}

export async function approveOrder(input: { id: string }): Promise<{ ok: boolean }> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_order", { p_order_id: parsed.data.id });
  return { ok: !error };
}
