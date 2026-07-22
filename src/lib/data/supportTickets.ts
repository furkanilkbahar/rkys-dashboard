import "server-only";

import { createClient } from "@/lib/supabase/server";

export type TicketStatus = "open" | "answered" | "resolved";

export type AdminSupportTicket = {
  id: string;
  subject: string;
  status: TicketStatus;
  createdAt: string;
};

export type TicketMessage = {
  id: string;
  sender: "tenant" | "platform";
  body: string;
  createdAt: string;
};

export type AdminTicketThread = {
  id: string;
  subject: string;
  status: TicketStatus;
  messages: TicketMessage[];
};

export async function getAdminSupportTickets(tenantId: string): Promise<AdminSupportTicket[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("support_tickets")
    .select("id, subject, status, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    subject: row.subject,
    status: row.status as TicketStatus,
    createdAt: row.created_at,
  }));
}

export async function getAdminTicketThread(ticketId: string): Promise<AdminTicketThread | null> {
  const supabase = await createClient();
  const [{ data: ticket }, { data: messages }] = await Promise.all([
    supabase.from("support_tickets").select("id, subject, status").eq("id", ticketId).single(),
    supabase.from("ticket_messages").select("id, sender, body, created_at").eq("ticket_id", ticketId).order("created_at"),
  ]);

  if (!ticket) return null;

  return {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status as TicketStatus,
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      sender: m.sender as "tenant" | "platform",
      body: m.body,
      createdAt: m.created_at,
    })),
  };
}
