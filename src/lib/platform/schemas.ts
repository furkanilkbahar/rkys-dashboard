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
