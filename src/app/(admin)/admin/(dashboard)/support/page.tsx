import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminSupportTickets } from "@/lib/data/supportTickets";

import { createTicket } from "./actions";
import { SupportTicketsManager } from "./support-tickets-manager";

export default async function AdminSupportPage() {
  const actor = await requireAdminActor();
  const tickets = await getAdminSupportTickets(actor.tenantId);

  return <SupportTicketsManager tickets={tickets} createTicket={createTicket} />;
}
