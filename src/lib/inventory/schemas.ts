import { z } from "zod";

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
