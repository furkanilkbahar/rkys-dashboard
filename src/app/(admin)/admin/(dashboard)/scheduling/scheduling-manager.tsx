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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminStaffMember } from "@/lib/data/adminStaff";
import type { AdminShift, HoursWorkedRow } from "@/lib/data/scheduling";
import { shiftFormSchema, type SchedulingActionResult, type ShiftFormInput } from "@/lib/scheduling/schemas";

export function SchedulingManager({
  staff,
  shifts,
  hoursWorked,
  createShift,
  deleteShift,
}: {
  staff: AdminStaffMember[];
  shifts: AdminShift[];
  hoursWorked: HoursWorkedRow[];
  createShift: (input: unknown) => Promise<SchedulingActionResult>;
  deleteShift: (shiftId: string) => Promise<SchedulingActionResult>;
}) {
  const t = useTranslations("admin.scheduling");
  const tErrors = useTranslations("admin.scheduling.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset } = useForm<ShiftFormInput>({
    resolver: standardSchemaResolver(shiftFormSchema),
    defaultValues: { profileId: "", shiftDate: "", startTime: "09:00", endTime: "17:00" },
  });

  async function onSubmit(values: ShiftFormInput) {
    setError(null);
    const result = await createShift(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    reset({ profileId: "", shiftDate: "", startTime: "09:00", endTime: "17:00" });
    router.refresh();
  }

  async function handleDelete(shiftId: string) {
    await deleteShift(shiftId);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{t("pageTitle")}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("scheduleTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {shifts.length === 0 && <p className="text-sm text-muted-foreground">{t("scheduleEmpty")}</p>}
          {shifts.map((shift) => (
            <div key={shift.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <span>
                {shift.badgeNo ?? "?"} · {shift.shiftDate} · {shift.startTime}–{shift.endTime}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(shift.id)}>
                {t("delete")}
              </Button>
            </div>
          ))}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="shift-staff">{t("staff")}</Label>
              <Controller
                control={control}
                name="profileId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                    <SelectTrigger id="shift-staff" className="w-40">
                      <SelectValue placeholder={t("staffPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.badgeNo ?? member.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="shift-date">{t("date")}</Label>
              <Input id="shift-date" type="date" className="w-40" {...register("shiftDate")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="shift-start">{t("startTime")}</Label>
              <Input id="shift-start" type="time" className="w-28" {...register("startTime")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="shift-end">{t("endTime")}</Label>
              <Input id="shift-end" type="time" className="w-28" {...register("endTime")} />
            </div>
            <Button type="submit" size="sm">
              {t("add")}
            </Button>
          </form>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("hoursTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {hoursWorked.length === 0 && <p className="text-sm text-muted-foreground">{t("hoursEmpty")}</p>}
          {hoursWorked.map((row) => (
            <div key={row.profileId} className="flex items-center justify-between text-sm">
              <span>{row.badgeNo ?? "?"}</span>
              <span className="text-muted-foreground">
                {t("hoursFormat", { hours: Math.floor(row.totalMinutes / 60), minutes: row.totalMinutes % 60 })}
              </span>
            </div>
          ))}
          <a href="/admin/scheduling/export" className="w-fit">
            <Button type="button" variant="outline" size="sm">
              {t("exportCsv")}
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
