import { z } from "zod";

const PRICE_PATTERN = /^\d+([.,]\d{1,2})?$/;

function priceMinorFromMajor(val: string): number {
  return Math.round(parseFloat(val.replace(",", ".")) * 100);
}

export const deliveryZoneFormSchema = z.object({
  name: z.string().min(1, "required"),
  fee: z.string().regex(PRICE_PATTERN, "invalid_price"),
  minBasket: z.string().regex(PRICE_PATTERN, "invalid_price"),
});
export type DeliveryZoneFormInput = z.infer<typeof deliveryZoneFormSchema>;

export function feeMinor(input: DeliveryZoneFormInput): number {
  return priceMinorFromMajor(input.fee);
}

export function minBasketMinor(input: DeliveryZoneFormInput): number {
  return priceMinorFromMajor(input.minBasket);
}

export type DeliveryZoneActionResult = { ok: true } | { ok: false; error: "invalid_input" | "forbidden" | "not_enabled" | "unknown" };
