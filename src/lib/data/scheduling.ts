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

export type StaffPerformanceRow = {
  profileId: string;
  badgeNo: string | null;
  callsResolved: number;
  avgResponseSeconds: number | null;
  targetCallsResolved: number | null;
};

// Faz 16 Adım 0 (S65): siparişler personel bazında atfedilmediği için
// (guest-driven QR sipariş modeli) hedef metriği garson çağrısı yanıt
// performansı — waiter_calls.acknowledged_by/acknowledged_at (0020) zaten
// bunu tutuyor, PRD §10'daki "garson performansı (yanıt süresi)" raporunun
// ilk somut kullanımı. Hedef dönemsiz (personel başına tek güncel hedef,
// 0082) — `from`/`to` yalnızca "gerçekleşen" tarafını (kayan rapor penceresi)
// belirler, hedefin kendisi her zaman güncel/tek değerdir.
export async function getStaffPerformance(
  tenantId: string,
  branchId: string,
  from: string,
  to: string,
): Promise<StaffPerformanceRow[]> {
  const supabase = await createClient();
  const [{ data: calls }, { data: goals }] = await Promise.all([
    supabase
      .from("waiter_calls")
      .select("acknowledged_by, created_at, acknowledged_at, profiles(badge_no)")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("status", "acknowledged")
      .not("acknowledged_by", "is", null)
      .gte("acknowledged_at", from)
      .lte("acknowledged_at", to),
    supabase
      .from("staff_performance_goals")
      .select("profile_id, target_calls_resolved")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId),
  ]);

  const targetByProfile = new Map((goals ?? []).map((g) => [g.profile_id, g.target_calls_resolved]));

  const statsByProfile = new Map<string, { badgeNo: string | null; count: number; totalResponseSeconds: number }>();
  for (const call of calls ?? []) {
    const profileId = call.acknowledged_by!;
    const responseSeconds = (new Date(call.acknowledged_at!).getTime() - new Date(call.created_at).getTime()) / 1000;
    const existing = statsByProfile.get(profileId);
    if (existing) {
      existing.count += 1;
      existing.totalResponseSeconds += responseSeconds;
    } else {
      statsByProfile.set(profileId, { badgeNo: call.profiles?.badge_no ?? null, count: 1, totalResponseSeconds: responseSeconds });
    }
  }

  const profileIds = new Set([...statsByProfile.keys(), ...targetByProfile.keys()]);

  return [...profileIds].map((profileId) => {
    const stats = statsByProfile.get(profileId);
    return {
      profileId,
      badgeNo: stats?.badgeNo ?? null,
      callsResolved: stats?.count ?? 0,
      avgResponseSeconds: stats ? Math.round(stats.totalResponseSeconds / stats.count) : null,
      targetCallsResolved: targetByProfile.get(profileId) ?? null,
    };
  });
}
