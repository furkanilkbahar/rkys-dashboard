"use server";

import { revalidatePath } from "next/cache";

import { getCurrentPlatformAdmin } from "@/lib/auth/platformSession";
import { ticketMessageFormSchema, type TicketActionResult } from "@/lib/support/schemas";
import { createClient } from "@/lib/supabase/server";

export async function replyAsPlatform(ticketId: string, input: unknown): Promise<TicketActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const parsed = ticketMessageFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data: ticket } = await supabase.from("support_tickets").select("tenant_id").eq("id", ticketId).single();
  if (!ticket) return { ok: false, error: "not_found" };

  const { error: messageError } = await supabase
    .from("ticket_messages")
    .insert({ ticket_id: ticketId, tenant_id: ticket.tenant_id, sender: "platform", body: parsed.data.body });
  if (messageError) return { ok: false, error: "unknown" };

  const { error: statusError } = await supabase
    .from("support_tickets")
    .update({ status: "answered", updated_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (statusError) return { ok: false, error: "unknown" };

  revalidatePath(`/platform/support/${ticketId}`);
  return { ok: true };
}

export async function resolveTicketAsPlatform(ticketId: string): Promise<TicketActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("support_tickets")
    .update({ status: "resolved", updated_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath(`/platform/support/${ticketId}`);
  return { ok: true };
}
