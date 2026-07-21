import { z } from "zod";

import { orderItemSchema } from "@/lib/orders/schemas";

export const staffOrderSchema = z.object({
  tableId: z.uuid(),
  items: z.array(orderItemSchema).min(1).max(30),
});
export type StaffOrderInput = z.infer<typeof staffOrderSchema>;

export type SubmitStaffOrderResult =
  | { ok: true; orderId: string; status: string; subtotalMinor: number }
  | { ok: false; error: "invalid_input" | "forbidden" | "stock_unavailable" | "unknown" };
