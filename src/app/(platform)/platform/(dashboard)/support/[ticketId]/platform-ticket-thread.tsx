"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { PlatformPageHeader } from "@/components/platform/platform-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PlatformTicketThread as PlatformTicketThreadData } from "@/lib/data/platformSupportTickets";
import { ticketMessageFormSchema, type TicketActionResult, type TicketMessageFormInput } from "@/lib/support/schemas";

export function PlatformTicketThread({
  thread,
  sendMessage,
  resolveTicket,
}: {
  thread: PlatformTicketThreadData;
  sendMessage: (ticketId: string, input: unknown) => Promise<TicketActionResult>;
  resolveTicket: (ticketId: string) => Promise<TicketActionResult>;
}) {
  const t = useTranslations("platform.support");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<TicketMessageFormInput>({
    resolver: standardSchemaResolver(ticketMessageFormSchema),
    defaultValues: { body: "" },
  });

  async function onSubmit(values: TicketMessageFormInput) {
    setError(null);
    const result = await sendMessage(thread.id, values);
    if (!result.ok) {
      setError(t("error"));
      return;
    }
    reset({ body: "" });
    router.refresh();
  }

  async function handleResolve() {
    setIsResolving(true);
    await resolveTicket(thread.id);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <PlatformPageHeader title={thread.subject} />
        <Badge variant={thread.status === "resolved" ? "secondary" : "outline"}>{t(`status.${thread.status}`)}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{thread.tenantName}</p>

      <div className="flex flex-col gap-3">
        {thread.messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-lg rounded-md border border-border p-3 text-sm ${message.sender === "tenant" ? "self-start bg-accent/30" : "self-end"}`}
          >
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {t(`sender.${message.sender}`)} — {new Date(message.createdAt).toLocaleString("tr-TR")}
            </p>
            <p>{message.body}</p>
          </div>
        ))}
      </div>

      {thread.status !== "resolved" && (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
          <Textarea placeholder={t("replyPlaceholder")} {...register("body")} />
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {t("reply")}
            </Button>
            <Button type="button" variant="outline" disabled={isResolving} onClick={handleResolve}>
              {t("resolve")}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
      )}
    </div>
  );
}
