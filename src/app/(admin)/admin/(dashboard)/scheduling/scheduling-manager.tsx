"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminStaffMember } from "@/lib/data/adminStaff";
import type { AdminShift, HoursWorkedRow, StaffPerformanceRow } from "@/lib/data/scheduling";
import { shiftFormSchema, type SchedulingActionResult, type ShiftFormInput } from "@/lib/scheduling/schemas";

function PerformanceCard({
  staff,
  staffPerformance,
  setStaffPerformanceGoal,
}: {
  staff: AdminStaffMember[];
  staffPerformance: StaffPerformanceRow[];
  setStaffPerformanceGoal: (profileId: string, targetCallsResolved: number) => Promise<SchedulingActionResult>;
}) {
  const t = useTranslations("admin.scheduling.performance");
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [targetInputs, setTargetInputs] = useState<Record<string, string>>({});

  const performanceByProfile = new Map(staffPerformance.map((row) => [row.profileId, row]));

  async function handleSaveTarget(profileId: string) {
    const raw = targetInputs[profileId];
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) return;
    setPendingId(profileId);
    await setStaffPerformanceGoal(profileId, parsed);
    setPendingId(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {staff.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        {staff.map((member) => {
          const row = performanceByProfile.get(member.id);
          const target = row?.targetCallsResolved ?? null;
          const resolved = row?.callsResolved ?? 0;
          const reached = target !== null && resolved >= target;
          const progressPercent = target ? Math.min(100, Math.round((resolved / target) * 100)) : 0;

          return (
            <div
              key={member.id}
              data-testid={`staff-performance-row-${member.id}`}
              className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{member.badgeNo ?? member.role}</span>
                <span className="text-muted-foreground">
                  {t("callsResolved", { count: resolved })}
                  {row?.avgResponseSeconds !== null && row?.avgResponseSeconds !== undefined
                    ? ` · ${t("avgResponse", { seconds: row.avgResponseSeconds })}`
                    : ""}
                </span>
              </div>
              {target !== null && (
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={reached ? "h-full bg-primary" : "h-full bg-muted-foreground/50"}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {resolved}/{target}
                  </span>
                  {reached && <span className="text-xs font-medium text-primary">{t("goalReached")}</span>}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  className="w-24"
                  placeholder={t("targetPlaceholder")}
                  value={targetInputs[member.id] ?? (target !== null ? String(target) : "")}
                  onChange={(e) => setTargetInputs((prev) => ({ ...prev, [member.id]: e.target.value }))}
                />
                <Button type="button" size="sm" variant="outline" disabled={pendingId === member.id} onClick={() => handleSaveTarget(member.id)}>
                  {t("setTarget")}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function SchedulingManager({
  staff,
  shifts,
  hoursWorked,
  staffPerformance,
  createShift,
  deleteShift,
  setStaffPerformanceGoal,
}: {
  staff: AdminStaffMember[];
  shifts: AdminShift[];
  hoursWorked: HoursWorkedRow[];
  staffPerformance: StaffPerformanceRow[];
  createShift: (input: unknown) => Promise<SchedulingActionResult>;
  deleteShift: (shiftId: string) => Promise<SchedulingActionResult>;
  setStaffPerformanceGoal: (profileId: string, targetCallsResolved: number) => Promise<SchedulingActionResult>;
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
      <AdminPageHeader title={t("pageTitle")} />
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

      <PerformanceCard staff={staff} staffPerformance={staffPerformance} setStaffPerformanceGoal={setStaffPerformanceGoal} />
    </div>
  );
}
