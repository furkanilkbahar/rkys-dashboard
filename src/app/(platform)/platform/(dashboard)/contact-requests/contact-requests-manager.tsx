"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlatformContactRequest } from "@/lib/data/platformContactRequests";
import type { PlatformActionResult } from "@/lib/platform/schemas";

function ContactRequestRow({
  request,
  resolveContactRequest,
}: {
  request: PlatformContactRequest;
  resolveContactRequest: (requestId: string, status: "contacted" | "closed") => Promise<PlatformActionResult>;
}) {
  const t = useTranslations("platform.contactRequests");
  const router = useRouter();
  const [pending, setPending] = useState<"contacted" | "closed" | null>(null);

  async function handleResolve(status: "contacted" | "closed") {
    setPending(status);
    await resolveContactRequest(request.id, status);
    setPending(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{request.name}</span>
          {request.businessName && <span className="text-sm text-muted-foreground">({request.businessName})</span>}
          <Badge variant={request.status === "new" ? "secondary" : "outline"}>{t(`status.${request.status}`)}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null || request.status !== "new"}
            onClick={() => handleResolve("contacted")}
          >
            {t("markContacted")}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending !== null || request.status === "closed"} onClick={() => handleResolve("closed")}>
            {t("close")}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        <span>{request.email}</span>
        {request.phone && <span>{request.phone}</span>}
        <span>{new Date(request.createdAt).toLocaleString("tr-TR")}</span>
      </div>
      <p className="text-sm">{request.message}</p>
    </div>
  );
}

export function ContactRequestsManager({
  requests,
  resolveContactRequest,
}: {
  requests: PlatformContactRequest[];
  resolveContactRequest: (requestId: string, status: "contacted" | "closed") => Promise<PlatformActionResult>;
}) {
  const t = useTranslations("platform.contactRequests");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("queueTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {requests.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
          {requests.map((request) => (
            <ContactRequestRow key={request.id} request={request} resolveContactRequest={resolveContactRequest} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
