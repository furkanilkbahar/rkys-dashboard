import { z } from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Kök domain'deki gerçek route'larla (ör. /admin, /platform) veya marka
// taklidiyle (ör. "rkys") çakışmasın diye ayrılmış subdomain'ler.
export const RESERVED_SLUGS = [
  "www",
  "admin",
  "platform",
  "api",
  "app",
  "mail",
  "ftp",
  "test",
  "status",
  "support",
  "kayit",
  "legal",
  "rkys",
];

export const registerSchema = z.object({
  businessName: z.string().min(1, "required"),
  slug: z
    .string()
    .min(3, "invalid_slug")
    .max(32, "invalid_slug")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "invalid_slug")
    .refine((value) => !RESERVED_SLUGS.includes(value), "slug_reserved"),
  email: z.email(),
  password: z.string().min(6),
});

export type RegisterInput = z.infer<typeof registerSchema>;