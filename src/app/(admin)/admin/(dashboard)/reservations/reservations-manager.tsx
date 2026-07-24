"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminTable } from "@/lib/data/adminTables";
import type { AdminReservation, AdminWaitlistEntry } from "@/lib/data/reservations";
import { type ReservationActionResult, staffReservationFormSchema, waitlistFormSchema } from "@/lib/reservations/schemas";

type StaffReservationFormValues = z.input<typeof staffReservationFormSchema>;
type WaitlistFormValues = z.input<typeof waitlistFormSchema>;

type ReservationActions = {
  createReservation: (branchId: string, input: unknown) => Promise<ReservationActionResult>;
  confirmReservation: (reservationId: string, tableId: string | null) => Promise<ReservationActionResult>;
  seatReservation: (reservationId: string) => Promise<ReservationActionResult>;
  cancelReservation: (reservationId: string) => Promise<ReservationActionResult>;
  markReservationNoShow: (reservationId: string) => Promise<ReservationActionResult>;
  addToWaitlist: (branchId: string, input: unknown) => Promise<ReservationActionResult>;
  callFromWaitlist: (entryId: string) => Promise<ReservationActionResult>;
  seatFromWaitlist: (entryId: string) => Promise<ReservationActionResult>;
  cancelWaitlistEntry: (entryId: string) => Promise<ReservationActionResult>;
};

function ReservationRow({ reservation, tables, actions }: { reservation: AdminReservation; tables: AdminTable[]; actions: ReservationActions }) {
  const t = useTranslations("admin.reservations");
  const router = useRouter();
  const [tableId, setTableId] = useState(reservation.tableId ?? "");

  async function run(fn: () => Promise<ReservationActionResult>) {
    await fn();
    router.refresh();
  }

  const canAct = reservation.status === "pending" || reservation.status === "confirmed";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span>
          <span className="font-medium">{reservation.customerName}</span> · {reservation.customerPhone} · {t("partySizeLabel", { count: reservation.partySize })}
        </span>
        <span className="text-xs text-muted-foreground">{t(`status.${reservation.status}`)}</span>
      </div>
      <span className="text-xs text-muted-foreground">{new Date(reservation.reservedAt).toLocaleString("tr-TR")}</span>
      {reservation.note && <span className="text-xs text-muted-foreground">{reservation.note}</span>}
      {canAct && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={tableId} onValueChange={(v) => setTableId(v ?? "")}>
            <SelectTrigger className="w-40" aria-label={t("table")}>
              <SelectValue placeholder={t("tablePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  {table.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" onClick={() => run(() => actions.confirmReservation(reservation.id, tableId || null))}>
            {t("confirm")}
          </Button>
          {reservation.status === "confirmed" && (
            <>
              <Button type="button" size="sm" variant="secondary" onClick={() => run(() => actions.seatReservation(reservation.id))}>
                {t("seat")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => run(() => actions.markReservationNoShow(reservation.id))}>
                {t("noShow")}
              </Button>
            </>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={() => run(() => actions.cancelReservation(reservation.id))}>
            {t("cancel")}
          </Button>
        </div>
      )}
    </div>
  );
}

function WaitlistRow({ entry, actions }: { entry: AdminWaitlistEntry; actions: ReservationActions }) {
  const t = useTranslations("admin.reservations.waitlist");
  const router = useRouter();

  async function run(fn: () => Promise<ReservationActionResult>) {
    await fn();
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
      <span>
        <span className="font-medium">{entry.customerName}</span>
        {entry.customerPhone && <> · {entry.customerPhone}</>} · {t("partySizeLabel", { count: entry.partySize })}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t(`status.${entry.status}`)}</span>
        {entry.status === "waiting" && (
          <Button type="button" size="sm" onClick={() => run(() => actions.callFromWaitlist(entry.id))}>
            {t("call")}
          </Button>
        )}
        {entry.status === "called" && (
          <Button type="button" size="sm" variant="secondary" onClick={() => run(() => actions.seatFromWaitlist(entry.id))}>
            {t("seat")}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={() => run(() => actions.cancelWaitlistEntry(entry.id))}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}

export function ReservationsManager({
  branchId,
  reservations,
  waitlist,
  tables,
  actions,
}: {
  branchId: string;
  reservations: AdminReservation[];
  waitlist: AdminWaitlistEntry[];
  tables: AdminTable[];
  actions: ReservationActions;
}) {
  const t = useTranslations("admin.reservations");
  const tErrors = useTranslations("admin.reservations.errors");
  const tWaitlist = useTranslations("admin.reservations.waitlist");
  const router = useRouter();
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  const reservationForm = useForm({
    resolver: standardSchemaResolver(staffReservationFormSchema),
    defaultValues: { customerName: "", customerPhone: "", partySize: "2", reservedAt: "", note: "" },
  });

  const waitlistForm = useForm({
    resolver: standardSchemaResolver(waitlistFormSchema),
    defaultValues: { customerName: "", customerPhone: "", partySize: "2" },
  });

  async function onCreateReservation(values: StaffReservationFormValues) {
    setReservationError(null);
    const result = await actions.createReservation(branchId, {
      ...values,
      reservedAt: values.reservedAt ? new Date(values.reservedAt).toISOString() : "",
    });
    if (!result.ok) {
      setReservationError(tErrors(result.error));
      return;
    }
    reservationForm.reset({ customerName: "", customerPhone: "", partySize: "2", reservedAt: "", note: "" });
    router.refresh();
  }

  async function onAddToWaitlist(values: WaitlistFormValues) {
    setWaitlistError(null);
    const result = await actions.addToWaitlist(branchId, values);
    if (!result.ok) {
      setWaitlistError(tErrors(result.error));
      return;
    }
    waitlistForm.reset({ customerName: "", customerPhone: "", partySize: "2" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{t("pageTitle")}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {reservations.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
          {reservations.map((reservation) => (
            <ReservationRow key={reservation.id} reservation={reservation} tables={tables} actions={actions} />
          ))}

          <form onSubmit={reservationForm.handleSubmit(onCreateReservation)} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="res-name">{t("customerName")}</Label>
              <Input id="res-name" className="w-36" {...reservationForm.register("customerName")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="res-phone">{t("customerPhone")}</Label>
              <Input id="res-phone" className="w-36" {...reservationForm.register("customerPhone")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="res-party-size">{t("partySize")}</Label>
              <Input id="res-party-size" type="number" min={1} max={50} className="w-20" {...reservationForm.register("partySize")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="res-date">{t("reservedAt")}</Label>
              <Input id="res-date" type="datetime-local" className="w-52" {...reservationForm.register("reservedAt")} />
            </div>
            <Button type="submit" size="sm">
              {t("add")}
            </Button>
          </form>
          {reservationError && <p className="text-xs text-destructive">{reservationError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tWaitlist("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {waitlist.length === 0 && <p className="text-sm text-muted-foreground">{tWaitlist("empty")}</p>}
          {waitlist.map((entry) => (
            <WaitlistRow key={entry.id} entry={entry} actions={actions} />
          ))}

          <form onSubmit={waitlistForm.handleSubmit(onAddToWaitlist)} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="wl-name">{t("customerName")}</Label>
              <Input id="wl-name" className="w-36" {...waitlistForm.register("customerName")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="wl-phone">{t("customerPhone")}</Label>
              <Input id="wl-phone" className="w-36" {...waitlistForm.register("customerPhone")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="wl-party-size">{t("partySize")}</Label>
              <Input id="wl-party-size" type="number" min={1} max={50} className="w-20" {...waitlistForm.register("partySize")} />
            </div>
            <Button type="submit" size="sm">
              {tWaitlist("add")}
            </Button>
          </form>
          {waitlistError && <p className="text-xs text-destructive">{waitlistError}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
