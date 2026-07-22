import { z } from "zod";

export const createTicketFormSchema = z.object({
  subject: z.string().min(1, "required"),
  body: z.string().min(1, "required"),
});
export type CreateTicketFormInput = z.infer<typeof createTicketFormSchema>;

export const ticketMessageFormSchema = z.object({
  body: z.string().min(1, "required"),
});
export type TicketMessageFormInput = z.infer<typeof ticketMessageFormSchema>;

export type TicketActionResult =
  | { ok: true }
  | { ok: false; error: "invalid_input" | "forbidden" | "not_found" | "unknown" };

export type CreateTicketResult =
  | { ok: true; ticketId: string }
  | { ok: false; error: "invalid_input" | "forbidden" | "unknown" };
