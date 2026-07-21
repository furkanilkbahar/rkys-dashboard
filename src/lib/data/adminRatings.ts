import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AdminRating = {
  id: string;
  stars: number;
  comment: string | null;
  staffStars: number | null;
  ratedStaffBadge: string | null;
  createdAt: string;
};

export type AdminRatingsSummary = {
  ratings: AdminRating[];
  averageStars: number | null;
  count: number;
};

export async function getAdminRatings(tenantId: string): Promise<AdminRatingsSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ratings")
    .select("id, stars, comment, staff_stars, created_at, profiles(badge_no)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const ratings = (data ?? []).map((r) => ({
    id: r.id,
    stars: r.stars,
    comment: r.comment,
    staffStars: r.staff_stars,
    ratedStaffBadge: r.profiles?.badge_no ?? null,
    createdAt: r.created_at,
  }));

  const averageStars = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length : null;

  return { ratings, averageStars, count: ratings.length };
}
