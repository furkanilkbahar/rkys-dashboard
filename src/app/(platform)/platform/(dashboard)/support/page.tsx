import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getPlatformSupportTickets } from "@/lib/data/platformSupportTickets";

export default async function PlatformSupportPage() {
  const t = await getTranslations("platform.support");
  const tickets = await getPlatformSupportTickets();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <div className="flex flex-col gap-2">
        {tickets.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        {tickets.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/platform/support/${ticket.id}`}
            className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-accent/50"
          >
            <div className="flex flex-col">
              <span className="font-medium">{ticket.subject}</span>
              <span className="text-xs text-muted-foreground">{ticket.tenantName}</span>
            </div>
            <Badge variant={ticket.status === "resolved" ? "secondary" : "outline"}>{t(`status.${ticket.status}`)}</Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
