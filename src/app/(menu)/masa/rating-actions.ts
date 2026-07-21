"use server";

import { getCurrentGuestSession } from "@/lib/guest/session";
import { submitRatingSchema, type SubmitRatingResult } from "@/lib/ratings/schemas";
import { createClient } from "@/lib/supabase/server";

export async function submitRating(input: unknown): Promise<SubmitRatingResult> {
  const parsed = submitRatingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const guest = await getCurrentGuestSession();
  if (!guest) {
    return { ok: false, error: "no_session" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_rating", {
    p_stars: parsed.data.stars,
    p_comment: parsed.data.comment ?? undefined,
    p_rated_staff_id: parsed.data.ratedStaffId ?? undefined,
    p_staff_stars: parsed.data.staffStars ?? undefined,
  });

  if (error || !data) {
    return { ok: false, error: "unknown" };
  }

  return { ok: true, ratingId: data as string };
}
