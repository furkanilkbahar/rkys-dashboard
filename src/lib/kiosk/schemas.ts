import { z } from "zod";

export const kioskDeviceFormSchema = z.object({
  deviceName: z.string().min(1),
});
export type KioskDeviceFormInput = z.infer<typeof kioskDeviceFormSchema>;

export type KioskActionResult = { ok: true } | { ok: false; error: "invalid_input" | "forbidden" | "not_enabled" | "unknown" };
