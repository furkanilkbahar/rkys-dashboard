import { z } from "zod";

export const orderItemSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().nullable(),
  quantity: z.number().int().min(1).max(20),
  extraIds: z.array(z.uuid()).max(10),
});

export const submitOrderSchema = z.object({
  idempotencyKey: z.uuid(),
  items: z.array(orderItemSchema).min(1).max(30),
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type SubmitOrderInput = z.infer<typeof submitOrderSchema>;

export type SubmitOrderResult =
  | { ok: true; orderId: string; status: string; subtotalMinor: number }
  | { ok: false; error: "invalid_input" | "no_session" | "stock_unavailable" | "rate_limited" | "unknown" };
