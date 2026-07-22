"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { announcementFormSchema, type AnnouncementFormInput } from "@/lib/platform/schemas";
import type { PlatformAnnouncement } from "@/lib/data/platformAnnouncements";

import { createAnnouncement, deleteAnnouncement, setAnnouncementActive } from "./actions";

export function AnnouncementsManager({ announcements }: { announcements: PlatformAnnouncement[] }) {
  const t = useTranslations("platform.announcements");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AnnouncementFormInput>({
    resolver: standardSchemaResolver(announcementFormSchema),
    defaultValues: { title: "", body: "", endsAt: "" },
  });
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function onSubmit(values: AnnouncementFormInput) {
    const result = await createAnnouncement(values);
    if (result.ok) reset();
  }

  async function handleToggle(id: string, isActive: boolean) {
    setPendingId(id);
    await setAnnouncementActive(id, isActive);
    setPendingId(null);
  }

  async function handleDelete(id: string) {
    setPendingId(id);
    await deleteAnnouncement(id);
    setPendingId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 rounded-md border border-border p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="title" className="text-sm font-medium">
            {t("titleLabel")}
          </label>
          <Input id="title" {...register("title")} />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="body" className="text-sm font-medium">
            {t("bodyLabel")}
          </label>
          <Textarea id="body" {...register("body")} />
          {errors.body && <p className="text-xs text-destructive">{errors.body.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="endsAt" className="text-sm font-medium">
            {t("endsAtLabel")}
          </label>
          <Input id="endsAt" type="datetime-local" {...register("endsAt")} />
        </div>
        <Button type="submit" disabled={isSubmitting} className="self-start">
          {t("create")}
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        {announcements.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        {announcements.map((announcement) => (
          <div key={announcement.id} className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{announcement.title}</span>
                <Badge variant={announcement.isActive ? "secondary" : "outline"}>
                  {announcement.isActive ? t("active") : t("inactive")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{announcement.body}</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={announcement.isActive}
                disabled={pendingId === announcement.id}
                onCheckedChange={(checked) => handleToggle(announcement.id, checked)}
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={pendingId === announcement.id}
                onClick={() => handleDelete(announcement.id)}
              >
                {t("delete")}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
