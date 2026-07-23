import { z } from "zod";

export const recordCompSchema = z.object({
  orderId: z.uuid(),
  amountMinor: z.number().int().positive(),
  reasonCodeId: z.uuid(),
  note: z.string().optional(),
});
export type RecordCompInput = z.infer<typeof recordCompSchema>;

export type RecordCompResult =
  | { ok: true; compId: string }
  | { ok: false; error: "invalid_input" | "forbidden" | "exceeds_subtotal" | "unknown" };

const refundItemAllocationSchema = z.object({
  orderItemId: z.uuid(),
  quantity: z.number().int().positive(),
  amountMinor: z.number().int().positive(),
});

export const refundPaymentSchema = z.object({
  paymentId: z.uuid(),
  amountMinor: z.number().int().positive(),
  reasonCodeId: z.uuid(),
  note: z.string().optional(),
  itemAllocations: z.array(refundItemAllocationSchema).nullable().optional(),
});
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;

export type RefundPaymentResult =
  | { ok: true; refundId: string }
  | { ok: false; error: "invalid_input" | "forbidden" | "not_refundable" | "exceeds_remaining" | "provider_failed" | "unknown" };
