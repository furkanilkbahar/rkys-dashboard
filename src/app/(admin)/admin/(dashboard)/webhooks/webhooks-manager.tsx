"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AdminWebhook, AdminWebhookDelivery } from "@/lib/data/webhooks";
import {
  WEBHOOK_EVENT_TYPE_LABEL_KEYS,
  WEBHOOK_EVENT_TYPES,
  webhookFormSchema,
  type WebhookActionResult,
  type WebhookEventType,
  type WebhookFormInput,
} from "@/lib/webhooks/schemas";

export function WebhooksManager({
  webhooks,
  deliveriesByWebhook,
  createWebhook,
  toggleWebhook,
}: {
  webhooks: AdminWebhook[];
  deliveriesByWebhook: Record<string, AdminWebhookDelivery[]>;
  createWebhook: (input: unknown) => Promise<WebhookActionResult>;
  toggleWebhook: (webhookId: string, isActive: boolean) => Promise<WebhookActionResult>;
}) {
  const t = useTranslations("admin.webhooks");
  const tGrid = useTranslations("admin.table");
  const tErrors = useTranslations("admin.webhooks.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset } = useForm<WebhookFormInput>({
    resolver: standardSchemaResolver(webhookFormSchema),
    defaultValues: { url: "", eventTypes: [] },
  });

  async function onSubmit(values: WebhookFormInput) {
    setError(null);
    const result = await createWebhook(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    reset({ url: "", eventTypes: [] });
    router.refresh();
  }

  async function handleToggle(webhookId: string, isActive: boolean) {
    await toggleWebhook(webhookId, isActive);
    router.refresh();
  }

  function eventTypeLabel(eventType: WebhookEventType) {
    return t(`eventType.${WEBHOOK_EVENT_TYPE_LABEL_KEYS[eventType]}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={t("pageTitle")} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <DataTable
            rows={webhooks}
            rowKey={(webhook) => webhook.id}
            empty={t("empty")}
            initialSort={{ key: "url" }}
            // Son teslimatlar HER ZAMAN açık bir genişleme satırında: bunlar
            // webhook'un çalışıp çalışmadığının tek kanıtı, bir tıklamanın
            // arkasına saklanmamalı. Teslimat yoksa satır hiç basılmaz.
            expandedRow={(webhook) =>
              (deliveriesByWebhook[webhook.id]?.length ?? 0) === 0 ? null : (
                <div className="flex flex-col gap-1 border-t border-[var(--surface-line)] pt-2">
                  <span className="text-[11px] font-medium text-[var(--surface-fg-faint)]">{t("deliveries")}</span>
                  {deliveriesByWebhook[webhook.id].map((delivery) => (
                    <div
                      key={delivery.id}
                      className="flex items-center justify-between gap-2 text-[11.5px] text-[var(--surface-fg-muted)]"
                    >
                      <span>{delivery.eventType}</span>
                      <span className="tabular-nums">
                        {t(`deliveryStatus.${delivery.status}`)} ({delivery.attemptCount})
                      </span>
                    </div>
                  ))}
                </div>
              )
            }
            columns={[
              {
                key: "url",
                header: t("url"),
                primary: true,
                value: (webhook) => webhook.url,
                cell: (webhook) => <span className="break-all">{webhook.url}</span>,
              },
              {
                key: "events",
                header: t("eventTypes"),
                value: (webhook) => webhook.eventTypes.map(eventTypeLabel).join(", "),
                cell: (webhook) => (
                  <span className="text-[var(--surface-fg-muted)]">
                    {webhook.eventTypes.map(eventTypeLabel).join(", ")}
                  </span>
                ),
              },
              {
                key: "secret",
                header: t("secret"),
                cell: (webhook) => (
                  <code className="text-[11.5px] break-all text-[var(--surface-fg-faint)]">{webhook.secret}</code>
                ),
              },
              {
                key: "active",
                header: tGrid("status"),
                align: "end",
                value: (webhook) => (webhook.isActive ? 1 : 0),
                cell: (webhook) => (
                  <Switch
                    checked={webhook.isActive}
                    aria-label={webhook.url}
                    onCheckedChange={(checked) => handleToggle(webhook.id, checked)}
                  />
                ),
              },
            ]}
          />

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2 border-t border-border pt-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="webhook-url">{t("url")}</Label>
              <Input id="webhook-url" className="w-full" placeholder="https://example.com/webhook" {...register("url")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("eventTypes")}</Label>
              <Controller
                control={control}
                name="eventTypes"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-3">
                    {WEBHOOK_EVENT_TYPES.map((eventType) => (
                      <label key={eventType} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={field.value.includes(eventType)}
                          onChange={(e) =>
                            field.onChange(e.target.checked ? [...field.value, eventType] : field.value.filter((v) => v !== eventType))
                          }
                        />
                        {eventTypeLabel(eventType)}
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>
            <Button type="submit" size="sm" className="w-fit">
              {t("add")}
            </Button>
          </form>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
