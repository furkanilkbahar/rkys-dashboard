import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/i18n/locales";

import { TENANT_MODULE_KEYS } from "./modules";

export const SUPPORTED_CURRENCIES = ["TRY", "USD", "EUR", "GBP"] as const;
export const SUPPORTED_TIMEZONES = [
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
] as const;

export const orderSettingsFormSchema = z.object({
  orderMode: z.enum(["direct", "approval"]),
  sessionTimeoutMinutes: z.coerce.number().int().min(1).max(1440),
});
export type OrderSettingsFormInput = z.infer<typeof orderSettingsFormSchema>;

export const businessSettingsFormSchema = z.object({
  currency: z.enum(SUPPORTED_CURRENCIES),
  timezone: z.enum(SUPPORTED_TIMEZONES),
});
export type BusinessSettingsFormInput = z.infer<typeof businessSettingsFormSchema>;

export const callTypeFormSchema = z.object({
  nameTr: z.string().min(1, "required"),
  nameEn: z.string().min(1, "required"),
  isActive: z.boolean(),
});
export type CallTypeFormInput = z.infer<typeof callTypeFormSchema>;

export const tipPresetFormSchema = z.object({
  label: z.string().min(1, "required"),
  percentage: z.coerce.number().int().min(1).max(100),
  isActive: z.boolean(),
});
export type TipPresetFormInput = z.infer<typeof tipPresetFormSchema>;

export const ratingSettingsFormSchema = z.object({
  isEnabled: z.boolean(),
  googleReviewUrl: z.union([z.literal(""), z.url()]),
});
export type RatingSettingsFormInput = z.infer<typeof ratingSettingsFormSchema>;

export const localeToggleSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
  isEnabled: z.boolean(),
});
export type LocaleToggleInput = z.infer<typeof localeToggleSchema>;

export const moduleToggleSchema = z.object({
  moduleKey: z.enum(TENANT_MODULE_KEYS),
  isEnabled: z.boolean(),
});
export type ModuleToggleInput = z.infer<typeof moduleToggleSchema>;

export type SettingsActionResult =
  | { ok: true }
  | { ok: false; error: "invalid_input" | "forbidden" | "not_found" | "last_locale" | "unknown" };
