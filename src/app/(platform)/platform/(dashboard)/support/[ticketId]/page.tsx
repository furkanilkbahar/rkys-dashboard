import { notFound } from "next/navigation";

import { getPlatformTicketThread } from "@/lib/data/platformSupportTickets";

import { replyAsPlatform, resolveTicketAsPlatform } from "../actions";
import { PlatformTicketThread } from "./platform-ticket-thread";

export default async function PlatformTicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const thread = await getPlatformTicketThread(ticketId);

  if (!thread) {
    notFound();
  }

  return <PlatformTicketThread thread={thread} sendMessage={replyAsPlatform} resolveTicket={resolveTicketAsPlatform} />;
}
