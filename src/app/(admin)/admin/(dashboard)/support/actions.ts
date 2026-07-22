"use server";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import { createTicketFormSchema, ticketMessageFormSchema, type CreateTicketResult, type TicketActionResult } from "@/lib/support/schemas";
import { createClient } from "@/lib/supabase/server";

export async function createTicket(input: unknown): Promise<CreateTicketResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = createTicketFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({ tenant_id: actor.tenantId, subject: parsed.data.subject, created_by: actor.userId })
    .select("id")
    .single();
  if (ticketError || !ticket) return { ok: false, error: "unknown" };

  const { error: messageError } = await supabase
    .from("ticket_messages")
    .insert({ ticket_id: ticket.id, tenant_id: actor.tenantId, sender: "tenant", body: parsed.data.body });
  if (messageError) return { ok: false, error: "unknown" };

  revalidatePath("/admin/support");
  return { ok: true, ticketId: ticket.id };
}

export async function sendTenantMessage(ticketId: string, input: unknown): Promise<TicketActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = ticketMessageFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ticket_messages")
    .insert({ ticket_id: ticketId, tenant_id: actor.tenantId, sender: "tenant", body: parsed.data.body });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath(`/admin/support/${ticketId}`);
  return { ok: true };
}

export async function resolveTicket(ticketId: string): Promise<TicketActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("support_tickets")
    .update({ status: "resolved", updated_at: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath(`/admin/support/${ticketId}`);
  return { ok: true };
}
