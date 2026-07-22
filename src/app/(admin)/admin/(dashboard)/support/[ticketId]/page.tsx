import { notFound } from "next/navigation";

import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminTicketThread } from "@/lib/data/supportTickets";

import { resolveTicket, sendTenantMessage } from "../actions";
import { TicketThread } from "./ticket-thread";

export default async function AdminTicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  await requireAdminActor();
  const { ticketId } = await params;
  const thread = await getAdminTicketThread(ticketId);

  if (!thread) {
    notFound();
  }

  return <TicketThread thread={thread} sendMessage={sendTenantMessage} resolveTicket={resolveTicket} />;
}
