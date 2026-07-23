import { z } from "zod";

const AMOUNT_PATTERN = /^\d+([.,]\d{1,2})?$/;

function amountMinorFromMajor(val: string): number {
  return Math.round(parseFloat(val.replace(",", ".")) * 100);
}

export const goalFormSchema = z.object({
  targetRevenue: z.string().regex(AMOUNT_PATTERN, "invalid_amount"),
});
export type GoalFormInput = z.infer<typeof goalFormSchema>;
export const goalServerSchema = goalFormSchema.transform((v) => ({
  targetRevenueMinor: amountMinorFromMajor(v.targetRevenue),
}));
