import { z } from "zod";

export const publicReservationRequestSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  partySize: z.coerce.number().int().min(1).max(50),
  reservedAt: z.iso.datetime({ offset: true }),
  note: z.string().optional(),
});
export type PublicReservationRequestInput = z.infer<typeof publicReservationRequestSchema>;

export const staffReservationFormSchema = publicReservationRequestSchema.extend({
  tableId: z.uuid().optional(),
});
export type StaffReservationFormInput = z.infer<typeof staffReservationFormSchema>;

export const waitlistFormSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  partySize: z.coerce.number().int().min(1).max(50),
});
export type WaitlistFormInput = z.infer<typeof waitlistFormSchema>;

export type ReservationActionResult = { ok: true } | { ok: false; error: "invalid_input" | "forbidden" | "not_enabled" | "unknown" };
