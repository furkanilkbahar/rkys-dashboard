"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

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
      <h1 className="text-xl font-semibold">{t("pageTitle")}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {webhooks.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="flex flex-col gap-2 rounded-md border border-border p-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-medium break-all">{webhook.url}</span>
                  <span className="text-xs text-muted-foreground">{webhook.eventTypes.map(eventTypeLabel).join(", ")}</span>
                  <code className="text-xs text-muted-foreground">{webhook.secret}</code>
                </div>
                <Switch checked={webhook.isActive} onCheckedChange={(checked) => handleToggle(webhook.id, checked)} />
              </div>
              {(deliveriesByWebhook[webhook.id]?.length ?? 0) > 0 && (
                <div className="flex flex-col gap-1 border-t border-border pt-2">
                  <span className="text-xs font-medium text-muted-foreground">{t("deliveries")}</span>
                  {deliveriesByWebhook[webhook.id].map((delivery) => (
                    <div key={delivery.id} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{delivery.eventType}</span>
                      <span>
                        {t(`deliveryStatus.${delivery.status}`)} ({delivery.attemptCount})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

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
