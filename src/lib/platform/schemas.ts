import { z } from "zod";

export const announcementFormSchema = z.object({
  title: z.string().min(1, "required"),
  body: z.string().min(1, "required"),
  endsAt: z.union([z.literal(""), z.iso.datetime({ local: true })]),
});
export type AnnouncementFormInput = z.infer<typeof announcementFormSchema>;

export type PlatformActionResult =
  | { ok: true }
  | { ok: false; error: "invalid_input" | "forbidden" | "not_found" | "unknown" };

export const licenseFormSchema = z.object({
  tenantId: z.uuid(),
  licenseType: z.enum(["lifetime", "self_hosted"]),
  expiresAt: z.union([z.literal(""), z.iso.date()]),
});
export type LicenseFormInput = z.infer<typeof licenseFormSchema>;

export type CreateLicenseResult =
  | { ok: true; licenseKey: string }
  | { ok: false; error: "invalid_input" | "forbidden" | "unknown" };

export const incidentFormSchema = z.object({
  title: z.string().min(1, "required"),
});
export type IncidentFormInput = z.infer<typeof incidentFormSchema>;

export const incidentUpdateFormSchema = z.object({
  body: z.string().min(1, "required"),
  status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
});
export type IncidentUpdateFormInput = z.infer<typeof incidentUpdateFormSchema>;

// key: RPC/veri katmanında sabit bir tanımlayıcı olarak kullanılır (i18n'siz,
// yalnızca platform admin görür) — starter/pro/unlimited ile aynı biçim.
export const planFormSchema = z.object({
  key: z
    .string()
    .min(1, "required")
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, "invalid"),
  name: z.string().min(1, "required"),
  priceMinor: z.coerce.number().int().min(0),
  tableLimit: z.union([z.literal(""), z.coerce.number().int().min(1)]),
  includedBranchCount: z.coerce.number().int().min(1),
  extraBranchPriceMinor: z.coerce.number().int().min(0),
  // D96: planın pazarlama ana sayfasındaki fiyat tablosunda görünüp
  // görünmeyeceği. Varsayılan true — yeni bir plan açan admin'in ayrıca
  // "vitrine koy" demesi gerekmesin; gizlemek bilinçli bir hareket olsun.
  //
  // `coerce` DEĞİL: değer bir <Switch>'ten geldiği için zaten boolean. Üstelik
  // `z.coerce.boolean()` "false" dizesini `true`'ya çevirir (boş olmayan her
  // dize truthy'dir) — yani gizlenmiş bir planı sessizce vitrine geri koyardı.
  isPublic: z.boolean().default(true),
});
export type PlanFormInput = z.infer<typeof planFormSchema>;

export const planUpdateFormSchema = planFormSchema.omit({ key: true });
export type PlanUpdateFormInput = z.infer<typeof planUpdateFormSchema>;
