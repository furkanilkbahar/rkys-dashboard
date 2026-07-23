import { z } from "zod";

const PRICE_PATTERN = /^\d+([.,]\d{1,2})?$/;

function priceMinorFromMajor(val: string): number {
  return Math.round(parseFloat(val.replace(",", ".")) * 100);
}

export const issueGiftCardFormSchema = z.object({
  code: z
    .string()
    .min(3, "required")
    .max(30, "required")
    .regex(/^[A-Za-z0-9_-]+$/, "invalid_input"),
  initialBalance: z.string().regex(PRICE_PATTERN, "invalid_price"),
});
export type IssueGiftCardFormInput = z.infer<typeof issueGiftCardFormSchema>;

export function initialBalanceMinor(input: IssueGiftCardFormInput): number {
  return priceMinorFromMajor(input.initialBalance);
}

export type GiftCardActionResult = { ok: true } | { ok: false; error: "invalid_input" | "forbidden" | "duplicate_code" | "not_enabled" | "unknown" };
