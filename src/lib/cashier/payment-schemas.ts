import { z } from "zod";

const itemAllocationSchema = z.object({
  orderItemId: z.uuid(),
  quantity: z.number().int().positive(),
  amountMinor: z.number().int().positive(),
});

export const recordPaymentSchema = z.object({
  tableSessionId: z.uuid(),
  method: z.enum(["cash", "card_manual", "gift_card"]),
  amountMinor: z.number().int().positive(),
  tipAmountMinor: z.number().int().min(0),
  splitGroup: z.uuid().nullable(),
  itemAllocations: z.array(itemAllocationSchema).nullable().optional(),
  giftCardCode: z.string().min(1).nullable().optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export type RecordPaymentResult =
  | { ok: true; paymentId: string }
  | { ok: false; error: "invalid_input" | "forbidden" | "not_open" | "invalid_gift_card" | "insufficient_gift_card_balance" | "unknown" };
