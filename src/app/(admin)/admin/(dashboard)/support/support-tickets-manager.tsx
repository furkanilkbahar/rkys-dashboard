"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AdminSupportTicket } from "@/lib/data/supportTickets";
import { createTicketFormSchema, type CreateTicketFormInput, type CreateTicketResult } from "@/lib/support/schemas";

export function SupportTicketsManager({
  tickets,
  createTicket,
}: {
  tickets: AdminSupportTicket[];
  createTicket: (input: unknown) => Promise<CreateTicketResult>;
}) {
  const t = useTranslations("admin.support");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<CreateTicketFormInput>({
    resolver: standardSchemaResolver(createTicketFormSchema),
    defaultValues: { subject: "", body: "" },
  });

  async function onSubmit(values: CreateTicketFormInput) {
    setError(null);
    const result = await createTicket(values);
    if (!result.ok) {
      setError(t("error"));
      return;
    }
    router.push(`/admin/support/${result.ticketId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t("title")} />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 rounded-md border border-border p-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="ticket-subject">{t("subject")}</Label>
          <Input id="ticket-subject" {...register("subject")} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ticket-body">{t("message")}</Label>
          <Textarea id="ticket-body" {...register("body")} />
        </div>
        <Button type="submit" disabled={isSubmitting} className="self-start">
          {t("create")}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>

      <div className="flex flex-col gap-2">
        {tickets.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        {tickets.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/admin/support/${ticket.id}`}
            className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-accent/50"
          >
            <span>{ticket.subject}</span>
            <Badge variant={ticket.status === "resolved" ? "secondary" : "outline"}>{t(`status.${ticket.status}`)}</Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
