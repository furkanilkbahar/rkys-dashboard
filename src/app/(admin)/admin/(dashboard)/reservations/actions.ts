"use server";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import { isEnabled } from "@/lib/modules/isEnabled";
import { type ReservationActionResult, staffReservationFormSchema, waitlistFormSchema } from "@/lib/reservations/schemas";
import { createClient } from "@/lib/supabase/server";

async function requireReservationsEnabled() {
  const actor = await getCurrentActor();
  if (!actor) return null;
  if (!(await isEnabled(actor.tenantId, "reservations"))) return null;
  return actor;
}

export async function createReservation(branchId: string, input: unknown): Promise<ReservationActionResult> {
  const actor = await requireReservationsEnabled();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = staffReservationFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.from("reservations").insert({
    tenant_id: actor.tenantId,
    branch_id: branchId,
    table_id: parsed.data.tableId || null,
    customer_name: parsed.data.customerName,
    customer_phone: parsed.data.customerPhone,
    party_size: parsed.data.partySize,
    reserved_at: parsed.data.reservedAt,
    note: parsed.data.note || null,
    created_by: actor.userId,
    status: "confirmed",
    confirmed_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/reservations");
  return { ok: true };
}

export async function confirmReservation(reservationId: string, tableId: string | null): Promise<ReservationActionResult> {
  const actor = await requireReservationsEnabled();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString(), table_id: tableId })
    .eq("id", reservationId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/reservations");
  return { ok: true };
}

export async function seatReservation(reservationId: string): Promise<ReservationActionResult> {
  const actor = await requireReservationsEnabled();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ status: "seated", seated_at: new Date().toISOString() })
    .eq("id", reservationId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/reservations");
  return { ok: true };
}

export async function cancelReservation(reservationId: string): Promise<ReservationActionResult> {
  const actor = await requireReservationsEnabled();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", reservationId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/reservations");
  return { ok: true };
}

export async function markReservationNoShow(reservationId: string): Promise<ReservationActionResult> {
  const actor = await requireReservationsEnabled();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.from("reservations").update({ status: "no_show" }).eq("id", reservationId).eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/reservations");
  return { ok: true };
}

export async function addToWaitlist(branchId: string, input: unknown): Promise<ReservationActionResult> {
  const actor = await requireReservationsEnabled();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = waitlistFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.from("waitlist_entries").insert({
    tenant_id: actor.tenantId,
    branch_id: branchId,
    customer_name: parsed.data.customerName,
    customer_phone: parsed.data.customerPhone || null,
    party_size: parsed.data.partySize,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/reservations");
  return { ok: true };
}

export async function callFromWaitlist(entryId: string): Promise<ReservationActionResult> {
  const actor = await requireReservationsEnabled();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("waitlist_entries")
    .update({ status: "called", called_at: new Date().toISOString() })
    .eq("id", entryId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/reservations");
  return { ok: true };
}

export async function seatFromWaitlist(entryId: string): Promise<ReservationActionResult> {
  const actor = await requireReservationsEnabled();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("waitlist_entries")
    .update({ status: "seated", seated_at: new Date().toISOString() })
    .eq("id", entryId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/reservations");
  return { ok: true };
}

export async function cancelWaitlistEntry(entryId: string): Promise<ReservationActionResult> {
  const actor = await requireReservationsEnabled();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.from("waitlist_entries").update({ status: "cancelled" }).eq("id", entryId).eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/reservations");
  return { ok: true };
}
