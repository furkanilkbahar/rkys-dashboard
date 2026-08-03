"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { PlatformPageHeader } from "@/components/platform/platform-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Incident, IncidentStatus } from "@/lib/data/incidents";
import {
  incidentFormSchema,
  incidentUpdateFormSchema,
  type IncidentFormInput,
  type IncidentUpdateFormInput,
  type PlatformActionResult,
} from "@/lib/platform/schemas";

const INCIDENT_STATUSES: IncidentStatus[] = ["investigating", "identified", "monitoring", "resolved"];

export function IncidentsManager({
  incidents,
  createIncident,
  addIncidentUpdate,
}: {
  incidents: Incident[];
  createIncident: (input: unknown) => Promise<PlatformActionResult>;
  addIncidentUpdate: (incidentId: string, input: unknown) => Promise<PlatformActionResult>;
}) {
  const t = useTranslations("platform.incidents");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<IncidentFormInput>({
    resolver: standardSchemaResolver(incidentFormSchema),
    defaultValues: { title: "" },
  });

  async function onSubmit(values: IncidentFormInput) {
    setError(null);
    const result = await createIncident(values);
    if (!result.ok) {
      setError(t("error"));
      return;
    }
    reset({ title: "" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PlatformPageHeader title={t("title")} />

      <form onSubmit={handleSubmit(onSubmit)} className="flex items-end gap-2 rounded-md border border-border p-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="incident-title">{t("newTitle")}</Label>
          <Input id="incident-title" className="w-72" {...register("title")} />
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {t("create")}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>

      <div className="flex flex-col gap-3">
        {incidents.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        {incidents.map((incident) => (
          <IncidentRow key={incident.id} incident={incident} addIncidentUpdate={addIncidentUpdate} />
        ))}
      </div>
    </div>
  );
}

function IncidentRow({
  incident,
  addIncidentUpdate,
}: {
  incident: Incident;
  addIncidentUpdate: (incidentId: string, input: unknown) => Promise<PlatformActionResult>;
}) {
  const t = useTranslations("platform.incidents");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting },
  } = useForm<IncidentUpdateFormInput>({
    resolver: standardSchemaResolver(incidentUpdateFormSchema),
    defaultValues: { body: "", status: incident.status },
  });

  async function onSubmit(values: IncidentUpdateFormInput) {
    setError(null);
    const result = await addIncidentUpdate(incident.id, values);
    if (!result.ok) {
      setError(t("error"));
      return;
    }
    reset({ body: "", status: values.status });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <div className="flex items-center gap-2">
        <span className="font-medium">{incident.title}</span>
        <Badge variant={incident.status === "resolved" ? "secondary" : "outline"}>{t(`status.${incident.status}`)}</Badge>
      </div>

      {incident.updates.map((update) => (
        <p key={update.id} className="text-sm text-muted-foreground">
          {new Date(update.createdAt).toLocaleString("tr-TR")} — {update.body}
        </p>
      ))}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2">
        <Textarea placeholder={t("updateBodyPlaceholder")} className="w-full" {...register("body")} />
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
            >
              {INCIDENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`status.${status}`)}
                </option>
              ))}
            </select>
          )}
        />
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {t("addUpdate")}
        </Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
