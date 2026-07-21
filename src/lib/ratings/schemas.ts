import { z } from "zod";

export const submitRatingSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  ratedStaffId: z.uuid().nullable(),
  staffStars: z.number().int().min(1).max(5).nullable(),
});
export type SubmitRatingInput = z.infer<typeof submitRatingSchema>;

export type SubmitRatingResult =
  | { ok: true; ratingId: string }
  | { ok: false; error: "invalid_input" | "no_session" | "unknown" };

// PRD §4 / RULES #30: yalnızca 4-5★ Google'a yönlenir, ≤3★ hiçbir koşulda
// yönlendirmez — regresyon riski yüksek olduğu için ayrı, saf bir fonksiyon
// olarak tutulur (bkz. tests/unit/ratings/threshold.test.ts).
export function shouldRedirectToGoogle(stars: number, googleReviewUrl: string | null): boolean {
  return stars > 3 && Boolean(googleReviewUrl);
}
