import { z } from "zod";

export const deviceSetupSchema = z.object({
  deviceSecret: z.string().min(1),
});
export type DeviceSetupInput = z.infer<typeof deviceSetupSchema>;

export const clockPinSchema = z.object({
  pin: z.string().min(1),
});
export type ClockPinInput = z.infer<typeof clockPinSchema>;

export type DeviceSetupResult = { ok: true } | { ok: false; error: "invalid_input" | "invalid_secret" };
export type ClockActionResult = { ok: true; action: "in" | "out"; badgeNo: string | null } | { ok: false; error: "invalid_device" | "invalid_pin" | "not_enabled" | "invalid_input" };

export const shiftFormSchema = z.object({
  profileId: z.uuid(),
  shiftDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});
export type ShiftFormInput = z.infer<typeof shiftFormSchema>;

export type SchedulingActionResult = { ok: true } | { ok: false; error: "invalid_input" | "forbidden" | "not_enabled" | "unknown" };
