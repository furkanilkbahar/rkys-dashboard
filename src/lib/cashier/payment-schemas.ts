import { z } from "zod";

export const recordPaymentSchema = z.object({
  tableSessionId: z.uuid(),
  method: z.enum(["cash", "card_manual"]),
  amountMinor: z.number().int().positive(),
  tipAmountMinor: z.number().int().min(0),
  splitGroup: z.uuid().nullable(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export type RecordPaymentResult =
  | { ok: true; paymentId: string }
  | { ok: false; error: "invalid_input" | "forbidden" | "not_open" | "unknown" };
