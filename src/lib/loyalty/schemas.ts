import { z } from "zod";

const PRICE_PATTERN = /^\d+([.,]\d{1,2})?$/;

// lib/menu/schemas.ts'teki priceMinorFromMajor ile aynı desen: admin TL
// cinsinden girer, burada kuruşa çevrilir (RULES: para integer kuruş).
function priceMinorFromMajor(val: string): number {
  return Math.round(parseFloat(val.replace(",", ".")) * 100);
}

export const LOYALTY_MODES = ["stamp", "points"] as const;
export type LoyaltyMode = (typeof LOYALTY_MODES)[number];

// Boş bırakılan (veya mode değişince unmount olan, react-hook-form'un
// shouldUnregister:false varsayılanıyla "" olarak kalan) opsiyonel alanlar
// react-hook-form'dan "" gelir — z.coerce.number() bunu 0'a çevirip .min(1)'i
// reddeder, boş string de PRICE_PATTERN'i hiç eşlemez (couponFormSchema.
// usageLimit'teki aynı bug, Faz 6). preprocess boşu undefined'a çevirir.
const emptyToUndefined = (v: unknown) => (v === "" || v === undefined ? undefined : v);

export const loyaltyProgramFormSchema = z
  .object({
    mode: z.enum(LOYALTY_MODES),
    isActive: z.boolean(),
    threshold: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).optional()),
    rewardValue: z.preprocess(emptyToUndefined, z.string().regex(PRICE_PATTERN, "invalid_price").optional()),
    earnRatePer100Minor: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).optional()),
    redeemRateValue: z.preprocess(emptyToUndefined, z.string().regex(PRICE_PATTERN, "invalid_price").optional()),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "stamp" && v.threshold === undefined) {
      ctx.addIssue({ code: "custom", path: ["threshold"], message: "required" });
    }
    if (v.mode === "stamp" && !v.rewardValue) {
      ctx.addIssue({ code: "custom", path: ["rewardValue"], message: "required" });
    }
    if (v.mode === "points" && v.earnRatePer100Minor === undefined) {
      ctx.addIssue({ code: "custom", path: ["earnRatePer100Minor"], message: "required" });
    }
    if (v.mode === "points" && !v.redeemRateValue) {
      ctx.addIssue({ code: "custom", path: ["redeemRateValue"], message: "required" });
    }
  });
export type LoyaltyProgramFormInput = z.infer<typeof loyaltyProgramFormSchema>;

export function buildLoyaltyConfig(input: LoyaltyProgramFormInput): Record<string, number> {
  if (input.mode === "stamp") {
    return { threshold: input.threshold!, rewardValueMinor: priceMinorFromMajor(input.rewardValue!) };
  }
  return { earnRatePer100Minor: input.earnRatePer100Minor!, redeemRateMinorPerPoint: priceMinorFromMajor(input.redeemRateValue!) };
}

export type LoyaltyActionResult = { ok: true } | { ok: false; error: "invalid_input" | "forbidden" | "unknown" };

export const redeemLoyaltySchema = z.object({ orderId: z.uuid() });
export type RedeemLoyaltyInput = z.infer<typeof redeemLoyaltySchema>;

export type RedeemLoyaltyResult =
  | { ok: true; discountMinor: number }
  | {
      ok: false;
      error: "invalid_input" | "no_session" | "forbidden" | "not_enabled" | "no_customer" | "not_active" | "insufficient_balance" | "not_applicable" | "unknown";
    };
