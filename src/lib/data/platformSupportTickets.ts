import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TicketMessage, TicketStatus } from "@/lib/data/supportTickets";

export type PlatformSupportTicket = {
  id: string;
  tenantId: string;
  tenantName: string;
  subject: string;
  status: TicketStatus;
  createdAt: string;
};

export type PlatformTicketThread = {
  id: string;
  tenantName: string;
  subject: string;
  status: TicketStatus;
  messages: TicketMessage[];
};

// support_tickets_platform_admin_all (0041) her tenant'ın kuyruğunu zaten
// açıyor — announcements'taki gibi service-role'e gerek yok, request-scoped
// client RLS üzerinden doğrudan çalışır.
export async function getPlatformSupportTickets(): Promise<PlatformSupportTicket[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("support_tickets")
    .select("id, tenant_id, subject, status, created_at, tenants(name)")
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    tenantName: row.tenants?.name ?? row.tenant_id,
    subject: row.subject,
    status: row.status as TicketStatus,
    createdAt: row.created_at,
  }));
}

export async function getPlatformTicketThread(ticketId: string): Promise<PlatformTicketThread | null> {
  const supabase = await createClient();
  const [{ data: ticket }, { data: messages }] = await Promise.all([
    supabase.from("support_tickets").select("id, subject, status, tenants(name)").eq("id", ticketId).single(),
    supabase.from("ticket_messages").select("id, sender, body, created_at").eq("ticket_id", ticketId).order("created_at"),
  ]);

  if (!ticket) return null;

  return {
    id: ticket.id,
    tenantName: ticket.tenants?.name ?? "",
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
