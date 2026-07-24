import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AdminShift = { id: string; profileId: string; badgeNo: string | null; shiftDate: string; startTime: string; endTime: string };

export async function getStaffShifts(tenantId: string, branchId: string, from: string, to: string): Promise<AdminShift[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_shifts")
    .select("id, profile_id, shift_date, start_time, end_time, profiles(badge_no)")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .gte("shift_date", from)
    .lte("shift_date", to)
    .order("shift_date")
    .order("start_time");

  return (data ?? []).map((s) => ({
    id: s.id,
    profileId: s.profile_id,
    badgeNo: s.profiles?.badge_no ?? null,
    shiftDate: s.shift_date,
    startTime: s.start_time,
    endTime: s.end_time,
  }));
}

export type HoursWorkedRow = { profileId: string; badgeNo: string | null; totalMinutes: number };

// Yalnızca KAPANMIŞ (clock_out_at not null) girişler toplanır — açık bir
// vardiya henüz bitmediği için maaş dönemi hesabına dahil edilmez.
export async function getHoursWorked(tenantId: string, branchId: string, from: string, to: string): Promise<HoursWorkedRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("timeclock_entries")
    .select("profile_id, clock_in_at, clock_out_at, profiles(badge_no)")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .not("clock_out_at", "is", null)
    .gte("clock_in_at", from)
    .lte("clock_in_at", to);

  const totals = new Map<string, { badgeNo: string | null; totalMinutes: number }>();
  for (const entry of data ?? []) {
    const minutes = (new Date(entry.clock_out_at!).getTime() - new Date(entry.clock_in_at).getTime()) / 60_000;
    const existing = totals.get(entry.profile_id);
    if (existing) {
      existing.totalMinutes += minutes;
    } else {
      totals.set(entry.profile_id, { badgeNo: entry.profiles?.badge_no ?? null, totalMinutes: minutes });
    }
  }

  return [...totals.entries()].map(([profileId, v]) => ({ profileId, badgeNo: v.badgeNo, totalMinutes: Math.round(v.totalMinutes) }));
}
