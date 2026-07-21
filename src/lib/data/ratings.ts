import "server-only";

import { createClient } from "@/lib/supabase/server";

export type GuestRatingSettings = {
  isEnabled: boolean;
  googleReviewUrl: string | null;
};

export async function getGuestRatingSettings(tenantId: string): Promise<GuestRatingSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rating_settings")
    .select("is_enabled, google_review_url")
    .eq("tenant_id", tenantId)
    .single();

  return { isEnabled: data?.is_enabled ?? false, googleReviewUrl: data?.google_review_url ?? null };
}

export type RatingWaiterOption = {
  id: string;
  badgeNo: string | null;
  photoUrl: string | null;
};

// RULES/ARCHITECTURE: profiles tenant-scoped'tur, şube ataması yok (çok
// şubeli personel planlaması Faz 4+'ın kapsamı) — bu yüzden branch_id ile
// filtrelenmez.
export async function getWaitersForRating(tenantId: string): Promise<RatingWaiterOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, badge_no, photo_url")
    .eq("tenant_id", tenantId)
    .eq("role", "waiter")
    .eq("is_active", true);

  return (data ?? []).map((p) => ({ id: p.id, badgeNo: p.badge_no, photoUrl: p.photo_url }));
}

export async function hasExistingRating(tableSessionId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("ratings").select("id").eq("table_session_id", tableSessionId).maybeSingle();
  return Boolean(data);
}

export async function getTableSessionStatus(tableSessionId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("table_sessions").select("status").eq("id", tableSessionId).single();
  return data?.status ?? null;
}
