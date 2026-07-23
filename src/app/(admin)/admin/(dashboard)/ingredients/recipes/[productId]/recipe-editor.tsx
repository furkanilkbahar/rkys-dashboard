"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminIngredient } from "@/lib/data/ingredients";
import type { AdminRecipeData, AdminRecipeVariant } from "@/lib/data/ingredients";
import type { InventoryActionResult } from "@/lib/inventory/schemas";

type Row = { ingredientId: string; quantityPerUnit: string };

function toRows(items: AdminRecipeData["recipes"][string] | undefined): Row[] {
  return (items ?? []).map((i) => ({ ingredientId: i.ingredientId, quantityPerUnit: String(i.quantityPerUnit) }));
}

export function RecipeEditor({
  recipe,
  ingredients,
  saveRecipe,
}: {
  recipe: AdminRecipeData;
  ingredients: AdminIngredient[];
  saveRecipe: (input: unknown) => Promise<InventoryActionResult>;
}) {
  const t = useTranslations("admin.ingredients.recipe");
  const tErrors = useTranslations("admin.ingredients.errors");
  const router = useRouter();
  const [selectedVariant, setSelectedVariant] = useState<AdminRecipeVariant>(recipe.variants[0]);
  const key = selectedVariant.id ?? "product";
  const [rows, setRows] = useState<Row[]>(() => toRows(recipe.recipes[key]));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function selectVariant(variant: AdminRecipeVariant) {
    setSelectedVariant(variant);
    setRows(toRows(recipe.recipes[variant.id ?? "product"]));
    setSaved(false);
  }

  function addRow() {
    setRows((prev) => [...prev, { ingredientId: ingredients[0]?.id ?? "", quantityPerUnit: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    const result = await saveRecipe({
      productId: recipe.productId,
      variantId: selectedVariant.id,
      items: rows.map((r) => ({ ingredientId: r.ingredientId, quantityPerUnit: r.quantityPerUnit })),
    });
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">
        {t("pageTitle")}: {recipe.productName}
      </h1>

      {recipe.variants.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {recipe.variants.map((variant) => (
            <Button
              key={variant.id ?? "product"}
              type="button"
              size="sm"
              variant={variant.id === selectedVariant.id ? "default" : "outline"}
              onClick={() => selectVariant(variant)}
            >
              {variant.label ?? t("productLevel")}
            </Button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("items")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">{t("emptyItems")}</p>}
          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select value={row.ingredientId} onValueChange={(v) => updateRow(index, { ingredientId: v ?? "" })}>
                <SelectTrigger aria-label={t("ingredient")} className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((ingredient) => (
                    <SelectItem key={ingredient.id} value={ingredient.id}>
                      {ingredient.name} ({ingredient.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="w-24"
                inputMode="decimal"
                placeholder={t("quantity")}
                value={row.quantityPerUnit}
                onChange={(e) => updateRow(index, { quantityPerUnit: e.target.value })}
              />
              <Button type="button" size="sm" variant="ghost" onClick={() => removeRow(index)}>
                {t("remove")}
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="secondary" onClick={addRow} disabled={ingredients.length === 0}>
            {t("addItem")}
          </Button>
          {ingredients.length === 0 && <p className="text-xs text-muted-foreground">{t("noIngredientsHint")}</p>}

          <div className="flex items-center gap-2 border-t border-border pt-3">
            <Button type="button" onClick={handleSave} disabled={rows.length === 0}>
              {t("save")}
            </Button>
            {saved && <span className="text-xs text-muted-foreground">{t("savedHint")}</span>}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
