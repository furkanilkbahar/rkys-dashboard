"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const idSchema = z.object({ id: z.uuid() });

export type MoveTableResult = { ok: true } | { ok: false; error: "forbidden" | "occupied" | "invalid_destination" | "unknown" };

function mapMoveTableError(message: string | undefined): Extract<MoveTableResult, { ok: false }>["error"] {
  if (!message) return "unknown";
  if (message.includes("PERMISSION_DENIED") || message.includes("staff only")) return "forbidden";
  if (message.includes("already occupied")) return "occupied";
  if (message.includes("invalid destination") || message.includes("not active")) return "invalid_destination";
  return "unknown";
}

export async function moveTableSession(tableSessionId: string, toTableId: string): Promise<MoveTableResult> {
  const parsed = z.object({ tableSessionId: z.uuid(), toTableId: z.uuid() }).safeParse({ tableSessionId, toTableId });
  if (!parsed.success) return { ok: false, error: "unknown" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("move_table_session", {
    p_table_session_id: parsed.data.tableSessionId,
    p_to_table_id: parsed.data.toTableId,
  });
  if (error) return { ok: false, error: mapMoveTableError(error.message) };

  revalidatePath("/waiter");
  return { ok: true };
}

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
