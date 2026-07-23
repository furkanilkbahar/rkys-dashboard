import { z } from "zod";

const PRICE_PATTERN = /^\d+([.,]\d{1,2})?$/;

function priceMinorFromMajor(val: string): number {
  return Math.round(parseFloat(val.replace(",", ".")) * 100);
}

export const INGREDIENT_UNITS = ["g", "kg", "ml", "l", "adet"] as const;
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];

export const ingredientFormSchema = z.object({
  name: z.string().min(1, "required"),
  unit: z.enum(INGREDIENT_UNITS),
  criticalLevel: z.coerce.number().min(0),
});
export type IngredientFormInput = z.infer<typeof ingredientFormSchema>;

export const recipeItemInputSchema = z.object({
  ingredientId: z.uuid(),
  quantityPerUnit: z.coerce.number().positive(),
});

export const recipeFormSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().nullable(),
  items: z.array(recipeItemInputSchema).min(1, "empty_recipe"),
});
export type RecipeFormInput = z.infer<typeof recipeFormSchema>;

export type InventoryActionResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "invalid_input" | "not_enabled" | "unknown" };

export const supplierFormSchema = z.object({
  name: z.string().min(1, "required"),
  contactInfo: z.string(),
});
export type SupplierFormInput = z.infer<typeof supplierFormSchema>;

export const purchaseFormSchema = z.object({
  ingredientId: z.uuid(),
  supplierId: z.union([z.literal(""), z.uuid()]),
  quantity: z.coerce.number().positive(),
  unitCost: z.string().regex(PRICE_PATTERN, "invalid_price"),
});
export type PurchaseFormInput = z.infer<typeof purchaseFormSchema>;

export function unitCostMinor(input: PurchaseFormInput): number {
  return priceMinorFromMajor(input.unitCost);
}
