import { z } from "zod";

export const staffUpdateFormSchema = z.object({
  fullName: z.string(),
  role: z.enum(["owner", "manager", "waiter", "kitchen", "courier"]),
  badgeNo: z.string(),
  isActive: z.boolean(),
});
export type StaffUpdateFormInput = z.infer<typeof staffUpdateFormSchema>;

// D87: PIN burada zorunlu — yeni personel, panel/kiosk cihazlarına PIN ile
// girer (bkz. lib/auth/waiterGuard.ts); e-posta/şifre hiç yüzeye çıkmaz.
export const createStaffMemberFormSchema = z.object({
  // Faz 23 (0091): zorunlu — yeni personel adsız açılırsa listede yalnızca
  // rozetle ayırt edilir ve rozet de opsiyonel; aynı açığı tekrar üretmemek
  // için ad girişte isteniyor.
  fullName: z.string().trim().min(1, "required"),
  role: z.enum(["owner", "manager", "waiter", "kitchen", "courier"]),
  badgeNo: z.string(),
  pin: z.string().regex(/^[0-9]{4,8}$/, "invalid_pin"),
});
export type CreateStaffMemberFormInput = z.infer<typeof createStaffMemberFormSchema>;

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
  // pin_in_use: reset_staff_pin (0071) aynı tenant'ta iki aktif personelin
  // aynı PIN'i taşımasını reddeder — kullanıcının düzeltebileceği bir durum,
  // bu yüzden genel "unknown"dan ayrı bir kod.
  | { ok: false; error: "invalid_input" | "forbidden" | "not_found" | "last_owner" | "pin_in_use" | "unknown" };

export type DeviceActionResult =
  | { ok: true; rawSecret: string }
  | { ok: false; error: "invalid_input" | "forbidden" | "unknown" };
