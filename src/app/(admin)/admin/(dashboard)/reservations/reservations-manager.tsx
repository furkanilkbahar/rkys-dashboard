"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DataTable, DataTableActions } from "@/components/admin/data-table";
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
  const tGrid = useTranslations("admin.table");
  const locale = useLocale();
  const router = useRouter();
  // Satır içi masa seçimi artık satır bileşeninde değil burada: seçilen masa
  // hem "Masa" kutusunun hem "Onayla" butonunun işi ve ikisi ayrı hücrede.
  const [tableSelections, setTableSelections] = useState<Record<string, string>>({});

  async function run(fn: () => Promise<ReservationActionResult>) {
    await fn();
    router.refresh();
  }
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  const reservationForm = useForm({
    resolver: standardSchemaResolver(staffReservationFormSchema),
    defaultValues: { customerName: "", customerPhone: "", partySize: "2", reservedAt: "", note: "", tableId: "" },
  });

  const waitlistForm = useForm({
    resolver: standardSchemaResolver(waitlistFormSchema),
    defaultValues: { customerName: "", customerPhone: "", partySize: "2" },
  });

  async function onCreateReservation(values: StaffReservationFormValues) {
    setReservationError(null);
    const result = await actions.createReservation(branchId, {
      ...values,
      tableId: values.tableId || undefined,
    });
    if (!result.ok) {
      setReservationError(tErrors(result.error));
      return;
    }
    reservationForm.reset({ customerName: "", customerPhone: "", partySize: "2", reservedAt: "", note: "", tableId: "" });
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
      <AdminPageHeader title={t("pageTitle")} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            rows={reservations}
            rowKey={(reservation) => reservation.id}
            empty={t("empty")}
            searchable
            initialSort={{ key: "reservedAt" }}
            columns={[
              {
                key: "customer",
                header: t("customerName"),
                primary: true,
                value: (reservation) => reservation.customerName,
                cell: (reservation) => reservation.customerName,
              },
              {
                key: "phone",
                header: t("customerPhone"),
                value: (reservation) => reservation.customerPhone,
                cell: (reservation) => (
                  <span className="text-[var(--surface-fg-muted)] tabular-nums">{reservation.customerPhone}</span>
                ),
              },
              {
                key: "reservedAt",
                header: t("reservedAt"),
                // ISO dizesi üzerinden sıralanıyor: yerelleştirilmiş metni
                // ("15.01.2027 19:30") sıralamak gün/ay/yıl sırası yüzünden
                // yanlış sonuç verirdi.
                value: (reservation) => reservation.reservedAt,
                cell: (reservation) => (
                  <span className="tabular-nums">{new Date(reservation.reservedAt).toLocaleString(locale)}</span>
                ),
              },
              {
                key: "partySize",
                header: t("partySize"),
                align: "end",
                value: (reservation) => reservation.partySize,
                cell: (reservation) => <span className="tabular-nums">{reservation.partySize}</span>,
              },
              {
                key: "status",
                header: tGrid("status"),
                value: (reservation) => reservation.status,
                cell: (reservation) => (
                  <span className="text-[var(--surface-fg-muted)]">{t(`status.${reservation.status}`)}</span>
                ),
              },
              {
                key: "actions",
                header: tGrid("actions"),
                actions: true,
                align: "end",
                cell: (reservation) => {
                  const canAct = reservation.status === "pending" || reservation.status === "confirmed";
                  if (!canAct) return null;
                  const selectedTableId = tableSelections[reservation.id] ?? reservation.tableId ?? "";

                  return (
                    <DataTableActions>
                      <Select
                        value={selectedTableId}
                        onValueChange={(value) =>
                          setTableSelections((current) => ({ ...current, [reservation.id]: value ?? "" }))
                        }
                      >
                        <SelectTrigger className="w-36" aria-label={t("table")}>
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
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => run(() => actions.confirmReservation(reservation.id, selectedTableId || null))}
                      >
                        {t("confirm")}
                      </Button>
                      {reservation.status === "confirmed" && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => run(() => actions.seatReservation(reservation.id))}
                          >
                            {t("seat")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => run(() => actions.markReservationNoShow(reservation.id))}
                          >
                            {t("noShow")}
                          </Button>
                        </>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => run(() => actions.cancelReservation(reservation.id))}
                      >
                        {t("cancel")}
                      </Button>
                    </DataTableActions>
                  );
                },
              },
            ]}
          />

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
              <Input
                id="res-date"
                type="datetime-local"
                className="w-52"
                {...reservationForm.register("reservedAt", {
                  setValueAs: (v: string) => (v ? new Date(v).toISOString() : ""),
                })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="res-table">{t("tableOptional")}</Label>
              <Controller
                control={reservationForm.control}
                name="tableId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                    <SelectTrigger id="res-table" className="w-40" aria-label={t("tableOptional")}>
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
                )}
              />
            </div>
            <Button type="submit" size="sm">
              {t("add")}
            </Button>
          </form>
          {reservationForm.formState.errors.reservedAt && <p className="text-xs text-destructive">{t("reservedAtInvalid")}</p>}
          {reservationError && <p className="text-xs text-destructive">{reservationError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tWaitlist("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            rows={waitlist}
            rowKey={(entry) => entry.id}
            empty={tWaitlist("empty")}
            columns={[
              {
                key: "customer",
                header: t("customerName"),
                primary: true,
                value: (entry) => entry.customerName,
                cell: (entry) => entry.customerName,
              },
              {
                key: "phone",
                header: t("customerPhone"),
                value: (entry) => entry.customerPhone,
                cell: (entry) =>
                  entry.customerPhone ? (
                    <span className="text-[var(--surface-fg-muted)] tabular-nums">{entry.customerPhone}</span>
                  ) : (
                    "—"
                  ),
              },
              {
                key: "partySize",
                header: t("partySize"),
                align: "end",
                value: (entry) => entry.partySize,
                cell: (entry) => <span className="tabular-nums">{entry.partySize}</span>,
              },
              {
                key: "status",
                header: tGrid("status"),
                value: (entry) => entry.status,
                cell: (entry) => (
                  <span className="text-[var(--surface-fg-muted)]">{tWaitlist(`status.${entry.status}`)}</span>
                ),
              },
              {
                key: "actions",
                header: tGrid("actions"),
                actions: true,
                align: "end",
                cell: (entry) => (
                  <DataTableActions>
                    {entry.status === "waiting" && (
                      <Button type="button" size="sm" onClick={() => run(() => actions.callFromWaitlist(entry.id))}>
                        {tWaitlist("call")}
                      </Button>
                    )}
                    {entry.status === "called" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => run(() => actions.seatFromWaitlist(entry.id))}
                      >
                        {tWaitlist("seat")}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => run(() => actions.cancelWaitlistEntry(entry.id))}
                    >
                      {tWaitlist("cancel")}
                    </Button>
                  </DataTableActions>
                ),
              },
            ]}
          />

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
