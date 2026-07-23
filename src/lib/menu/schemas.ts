import { z } from "zod";

const PRICE_PATTERN = /^\d+([.,]\d{1,2})?$/;
const STOCK_PATTERN = /^\d+$/;

// RULES: para değerleri integer kuruş (minor units) olarak saklanır.
// Form kullanıcıdan TL cinsinden ondalık girdi alır (string), burada kuruşa
// çevrilir. İki katman var: "form" şemaları react-hook-form resolver'ı için
// giriş=çıkış tipini string tutar (yalnız doğrulama); "server" şemaları aynı
// alanları transform ederek server action'ın alacağı sayısal şekli üretir —
// react-hook-form'un tek generic'li useForm'u input/output tipinin aynı
// olmasını beklediği için bu ayrım gerekiyor (transform tipi değiştiriyor).
function priceMinorFromMajor(val: string): number {
  return Math.round(parseFloat(val.replace(",", ".")) * 100);
}

function stockFromInput(val: string): number | null {
  return val === "" ? null : parseInt(val, 10);
}

export const categoryFormSchema = z.object({
  layout: z.enum(["grid", "list", "showcase"]),
  nameTr: z.string().min(1, "required"),
  nameEn: z.string(),
  isActive: z.boolean(),
  station: z.string(),
});
export type CategoryFormInput = z.infer<typeof categoryFormSchema>;

// station serbest metin alanı: boş bırakılırsa "istasyonsuz" (null) anlamına
// gelir — KDS'nin istasyon filtresi olmadan bugünkü gibi tek ekran davranışı.
export const categoryServerSchema = categoryFormSchema.transform((v) => ({
  ...v,
  station: v.station.trim() === "" ? null : v.station.trim(),
}));

export const productFormSchema = z.object({
  categoryId: z.uuid(),
  basePrice: z.string().regex(PRICE_PATTERN, "invalid_price"),
  stockQuantity: z.union([z.literal(""), z.string().regex(STOCK_PATTERN, "invalid_stock")]),
  isSoldOut: z.boolean(),
  isActive: z.boolean(),
  nameTr: z.string().min(1, "required"),
  nameEn: z.string(),
  descriptionTr: z.string(),
  descriptionEn: z.string(),
});
export type ProductFormInput = z.infer<typeof productFormSchema>;

export const productServerSchema = productFormSchema.transform((v) => ({
  ...v,
  basePrice: priceMinorFromMajor(v.basePrice),
  stockQuantity: stockFromInput(v.stockQuantity),
}));

export const variantFormSchema = z.object({
  productId: z.uuid(),
  price: z.string().regex(PRICE_PATTERN, "invalid_price"),
  stockQuantity: z.union([z.literal(""), z.string().regex(STOCK_PATTERN, "invalid_stock")]),
  isSoldOut: z.boolean(),
  isActive: z.boolean(),
  nameTr: z.string().min(1, "required"),
  nameEn: z.string(),
});
export type VariantFormInput = z.infer<typeof variantFormSchema>;

export const variantServerSchema = variantFormSchema.transform((v) => ({
  ...v,
  price: priceMinorFromMajor(v.price),
  stockQuantity: stockFromInput(v.stockQuantity),
}));

export const extraFormSchema = z.object({
  productId: z.uuid(),
  price: z.string().regex(PRICE_PATTERN, "invalid_price"),
  stockQuantity: z.union([z.literal(""), z.string().regex(STOCK_PATTERN, "invalid_stock")]),
  isSoldOut: z.boolean(),
  isActive: z.boolean(),
  nameTr: z.string().min(1, "required"),
  nameEn: z.string(),
});
export type ExtraFormInput = z.infer<typeof extraFormSchema>;

export const extraServerSchema = extraFormSchema.transform((v) => ({
  ...v,
  price: priceMinorFromMajor(v.price),
  stockQuantity: stockFromInput(v.stockQuantity),
}));

export type MenuActionResult =
  | { ok: true }
  | { ok: false; error: "invalid_input" | "forbidden" | "not_found" | "unknown" };

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type ImageActionResult =
  | { ok: true; imageUrl: string }
  | { ok: false; error: "invalid_input" | "forbidden" | "too_large" | "unsupported_type" | "unknown" };
