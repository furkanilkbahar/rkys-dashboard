import { z } from "zod";

export const zoneFormSchema = z.object({
  name: z.string().min(1, "required"),
  isActive: z.boolean(),
});
export type ZoneFormInput = z.infer<typeof zoneFormSchema>;

export const tableFormSchema = z.object({
  label: z.string().min(1, "required"),
  zoneId: z.union([z.literal(""), z.uuid()]),
  isActive: z.boolean(),
});
export type TableFormInput = z.infer<typeof tableFormSchema>;

export const genericQrFormSchema = z.object({
  label: z.string().min(1, "required"),
});
export type GenericQrFormInput = z.infer<typeof genericQrFormSchema>;

export type TableActionResult =
  | { ok: true }
  | { ok: false; error: "invalid_input" | "forbidden" | "not_found" | "unknown" };

export type QrRevealResult =
  | { ok: true; rawToken: string; guestPath: string }
  | { ok: false; error: "invalid_input" | "forbidden" | "not_found" | "unknown" };
