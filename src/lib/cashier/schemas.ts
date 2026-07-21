import { z } from "zod";

const AMOUNT_PATTERN = /^\d+([.,]\d{1,2})?$/;

function amountMinorFromMajor(val: string): number {
  return Math.round(parseFloat(val.replace(",", ".")) * 100);
}

export const openShiftFormSchema = z.object({
  openingBalance: z.string().regex(AMOUNT_PATTERN, "invalid_amount"),
});
export type OpenShiftFormInput = z.infer<typeof openShiftFormSchema>;
export const openShiftServerSchema = openShiftFormSchema.transform((v) => ({
  openingBalance: amountMinorFromMajor(v.openingBalance),
}));

export const closeShiftFormSchema = z.object({
  countedCash: z.string().regex(AMOUNT_PATTERN, "invalid_amount"),
});
export type CloseShiftFormInput = z.infer<typeof closeShiftFormSchema>;
export const closeShiftServerSchema = closeShiftFormSchema.transform((v) => ({
  countedCash: amountMinorFromMajor(v.countedCash),
}));

export const cashMovementFormSchema = z.object({
  movementType: z.enum(["cash_in", "cash_out"]),
  amount: z.string().regex(AMOUNT_PATTERN, "invalid_amount"),
  note: z.string(),
});
export type CashMovementFormInput = z.infer<typeof cashMovementFormSchema>;
export const cashMovementServerSchema = cashMovementFormSchema.transform((v) => ({
  movementType: v.movementType,
  amount: amountMinorFromMajor(v.amount),
  note: v.note,
}));

export type CashierActionResult =
  | { ok: true }
  | { ok: false; error: "invalid_input" | "forbidden" | "already_open" | "not_open" | "unknown" };

export type OpenShiftResult =
  | { ok: true; shiftId: string }
  | { ok: false; error: "invalid_input" | "forbidden" | "already_open" | "unknown" };
