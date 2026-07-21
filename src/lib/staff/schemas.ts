import { z } from "zod";

export const staffUpdateFormSchema = z.object({
  role: z.enum(["owner", "manager", "waiter", "kitchen", "courier"]),
  badgeNo: z.string(),
  isActive: z.boolean(),
});
export type StaffUpdateFormInput = z.infer<typeof staffUpdateFormSchema>;

export const pinResetFormSchema = z.object({
  pin: z.string().regex(/^[0-9]{4,8}$/, "invalid_pin"),
});
export type PinResetFormInput = z.infer<typeof pinResetFormSchema>;

export const deviceFormSchema = z.object({
  label: z.string().min(1, "required"),
});
export type DeviceFormInput = z.infer<typeof deviceFormSchema>;

export type StaffActionResult =
  | { ok: true }
  | { ok: false; error: "invalid_input" | "forbidden" | "not_found" | "last_owner" | "unknown" };

export type DeviceActionResult =
  | { ok: true; rawSecret: string }
  | { ok: false; error: "invalid_input" | "forbidden" | "unknown" };
