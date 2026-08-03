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

// D89: saf eşik fonksiyonu ./threshold.ts'e taşındı — client bileşenleri onu
// bu dosyadan (zod'lu) import ettiğinde 63 KB gzip misafir bundle'ına
// giriyordu. Geriye dönük uyumluluk için yeniden export ediliyor; YENİ client
// kodu doğrudan "@/lib/ratings/threshold"tan almalı.
export { shouldRedirectToGoogle } from "./threshold";
