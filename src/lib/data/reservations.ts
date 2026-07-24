import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ReservationStatus = "pending" | "confirmed" | "seated" | "cancelled" | "no_show";

export type AdminReservation = {
  id: string;
  tableId: string | null;
  tableLabel: string | null;
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservedAt: string;
  status: ReservationStatus;
  note: string | null;
};

export async function getAdminReservations(tenantId: string, branchId: string): Promise<AdminReservation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select("id, table_id, customer_name, customer_phone, party_size, reserved_at, status, note, tables(label)")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .order("reserved_at");

  return (data ?? []).map((r) => ({
    id: r.id,
    tableId: r.table_id,
    tableLabel: r.tables?.label ?? null,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    partySize: r.party_size,
    reservedAt: r.reserved_at,
    status: r.status as ReservationStatus,
    note: r.note,
  }));
}

// Garson paneli için: "bugün" tenant saat dilimine göre hesaplamak yerine
// (bkz. TESTING.md §7 UTC/tenant-timezone tuzağı), reserved_at zaten
// misafirin seçtiği kesin bir zaman damgası — burada basitçe "önümüzdeki
// rezervasyonlar" (şu andan itibaren) gösterilir, gün sınırı hesaplanmaz.
export async function getUpcomingReservations(tenantId: string, branchId: string, limit = 10): Promise<AdminReservation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select("id, table_id, customer_name, customer_phone, party_size, reserved_at, status, note, tables(label)")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .in("status", ["pending", "confirmed"])
    .gte("reserved_at", new Date().toISOString())
    .order("reserved_at")
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id,
    tableId: r.table_id,
    tableLabel: r.tables?.label ?? null,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    partySize: r.party_size,
    reservedAt: r.reserved_at,
    status: r.status as ReservationStatus,
    note: r.note,
  }));
}

export type WaitlistStatus = "waiting" | "called" | "seated" | "cancelled";

export type AdminWaitlistEntry = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  partySize: number;
  status: WaitlistStatus;
  createdAt: string;
};

export async function getAdminWaitlist(tenantId: string, branchId: string): Promise<AdminWaitlistEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("waitlist_entries")
    .select("id, customer_name, customer_phone, party_size, status, created_at")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .in("status", ["waiting", "called"])
    .order("created_at");

  return (data ?? []).map((w) => ({
    id: w.id,
    customerName: w.customer_name,
    customerPhone: w.customer_phone,
    partySize: w.party_size,
    status: w.status as WaitlistStatus,
    createdAt: w.created_at,
  }));
}
