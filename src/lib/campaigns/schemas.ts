import { z } from "zod";

export const CAMPAIGN_RULE_TYPES = ["bogo", "time_window", "category_discount", "percentage_off"] as const;
export type CampaignRuleType = (typeof CAMPAIGN_RULE_TYPES)[number];

// Kural tipine göre hangi alanların dolu olması gerektiği farklıdır — form
// tüm alanları taşır (UI ruleType'a göre gösterir/gizler), server tarafı
// yalnızca ilgili olanları rule_config jsonb'sine yazar (aşağıdaki
// buildRuleConfig). Tek şema + superRefine, dört ayrı şema yerine (kural
// tipleri arasında çoğu alan zaten ortak: percentage).
export const campaignFormSchema = z
  .object({
    name: z.string().min(1, "required"),
    ruleType: z.enum(CAMPAIGN_RULE_TYPES),
    percentage: z.coerce.number().int().min(1).max(100).optional(),
    productId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    startHour: z.coerce.number().int().min(0).max(23).optional(),
    endHour: z.coerce.number().int().min(0).max(23).optional(),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.ruleType === "percentage_off" && v.percentage === undefined) {
      ctx.addIssue({ code: "custom", path: ["percentage"], message: "required" });
    }
    if (v.ruleType === "bogo" && !v.productId) {
      ctx.addIssue({ code: "custom", path: ["productId"], message: "required" });
    }
    if (v.ruleType === "category_discount" && (!v.categoryId || v.percentage === undefined)) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "required" });
    }
    if (v.ruleType === "time_window" && (v.startHour === undefined || v.endHour === undefined || v.percentage === undefined)) {
      ctx.addIssue({ code: "custom", path: ["startHour"], message: "required" });
    }
  });
export type CampaignFormInput = z.infer<typeof campaignFormSchema>;

export function buildRuleConfig(input: CampaignFormInput): Record<string, unknown> {
  switch (input.ruleType) {
    case "percentage_off":
      return { percentage: input.percentage };
    case "bogo":
      return { productId: input.productId };
    case "category_discount":
      return { categoryId: input.categoryId, percentage: input.percentage };
    case "time_window":
      return { startHour: input.startHour, endHour: input.endHour, percentage: input.percentage };
  }
}

export const couponFormSchema = z.object({
  campaignId: z.uuid(),
  code: z
    .string()
    .min(3, "required")
    .max(30, "required")
    .regex(/^[A-Za-z0-9_-]+$/, "invalid_input"),
  // Boş bırakılan opsiyonel sayı input'u react-hook-form'dan "" (boş metin)
  // olarak gelir — z.coerce.number() bunu 0'a çevirir (Number("") === 0),
  // .positive() bu yüzden reddeder. preprocess boşu undefined'a çevirerek
  // alanı gerçekten opsiyonel kılar.
  usageLimit: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().positive().optional()),
  isActive: z.boolean(),
});
export type CouponFormInput = z.infer<typeof couponFormSchema>;

export type CampaignActionResult =
  | { ok: true }
  | { ok: false; error: "invalid_input" | "forbidden" | "unknown" };

export const applyCouponSchema = z.object({
  orderId: z.uuid(),
  code: z.string().min(1),
});
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;

export type ApplyCouponResult =
  | { ok: true; discountMinor: number }
  | {
      ok: false;
      error:
        | "invalid_input"
        | "no_session"
        | "forbidden"
        | "invalid_code"
        | "limit_reached"
        | "already_applied"
        | "not_active"
        | "not_applicable"
        | "unknown";
    };
