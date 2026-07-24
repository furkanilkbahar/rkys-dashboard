"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReservationActionResult } from "@/lib/reservations/schemas";

export function ReservationRequestForm({
  tenantId,
  createPublicReservation,
}: {
  tenantId: string;
  createPublicReservation: (tenantId: string, input: unknown) => Promise<ReservationActionResult>;
}) {
  const t = useTranslations("menu.reservation");
  const tErrors = useTranslations("menu.reservation.errors");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [reservedAt, setReservedAt] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await createPublicReservation(tenantId, {
      customerName,
      customerPhone,
      partySize: Number(partySize),
      reservedAt: reservedAt ? new Date(reservedAt).toISOString() : "",
      note: note || undefined,
    });
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return <p className="text-sm text-muted-foreground">{t("submitted")}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="reservation-name">{t("customerName")}</Label>
        <Input id="reservation-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="reservation-phone">{t("customerPhone")}</Label>
        <Input id="reservation-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="reservation-party-size">{t("partySize")}</Label>
        <Input id="reservation-party-size" type="number" min={1} max={50} value={partySize} onChange={(e) => setPartySize(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="reservation-date">{t("reservedAt")}</Label>
        <Input id="reservation-date" type="datetime-local" value={reservedAt} onChange={(e) => setReservedAt(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="reservation-note">{t("note")}</Label>
        <Textarea id="reservation-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button type="submit">{t("submit")}</Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
