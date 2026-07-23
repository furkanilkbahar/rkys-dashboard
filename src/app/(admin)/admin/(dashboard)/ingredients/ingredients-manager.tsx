"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { z } from "zod";

import type { AdminIngredient } from "@/lib/data/ingredients";
import { INGREDIENT_UNITS, ingredientFormSchema, type InventoryActionResult } from "@/lib/inventory/schemas";

type IngredientFormValues = z.input<typeof ingredientFormSchema>;

export function IngredientsManager({
  ingredients,
  createIngredient,
  updateIngredient,
}: {
  ingredients: AdminIngredient[];
  createIngredient: (input: unknown) => Promise<InventoryActionResult>;
  updateIngredient: (ingredientId: string, input: unknown) => Promise<InventoryActionResult>;
}) {
  const t = useTranslations("admin.ingredients");
  const tErrors = useTranslations("admin.ingredients.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset } = useForm({
    resolver: standardSchemaResolver(ingredientFormSchema),
    defaultValues: { name: "", unit: "g", criticalLevel: "0" },
  });

  async function onSubmit(values: IngredientFormValues) {
    setError(null);
    const result = await createIngredient(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    reset({ name: "", unit: "g", criticalLevel: "0" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{t("pageTitle")}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {ingredients.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
          {ingredients.map((ingredient) => (
            <IngredientRow key={ingredient.id} ingredient={ingredient} updateIngredient={updateIngredient} />
          ))}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="ingredient-name">{t("name")}</Label>
              <Input id="ingredient-name" className="w-40" {...register("name")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ingredient-unit">{t("unit")}</Label>
              <Controller
                control={control}
                name="unit"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="ingredient-unit" aria-label={t("unit")} className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INGREDIENT_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ingredient-critical">{t("criticalLevel")}</Label>
              <Input id="ingredient-critical" className="w-24" inputMode="decimal" {...register("criticalLevel")} />
            </div>
            <Button type="submit" size="sm">
              {t("add")}
            </Button>
          </form>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function IngredientRow({
  ingredient,
  updateIngredient,
}: {
  ingredient: AdminIngredient;
  updateIngredient: (ingredientId: string, input: unknown) => Promise<InventoryActionResult>;
}) {
  const t = useTranslations("admin.ingredients");
  const router = useRouter();
  const [criticalLevel, setCriticalLevel] = useState(String(ingredient.criticalLevel));
  const isCritical = ingredient.currentStock <= ingredient.criticalLevel;

  async function handleSave() {
    await updateIngredient(ingredient.id, { name: ingredient.name, unit: ingredient.unit, criticalLevel });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">{ingredient.name}</span>
        <span className="text-xs text-muted-foreground">({ingredient.unit})</span>
        {isCritical && (
          <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">{t("criticalBadge")}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {t("stock")}: {ingredient.currentStock}
        </span>
        <Label htmlFor={`critical-${ingredient.id}`} className="text-xs text-muted-foreground">
          {t("criticalLevel")}
        </Label>
        <Input
          id={`critical-${ingredient.id}`}
          className="w-20"
          inputMode="decimal"
          value={criticalLevel}
          onChange={(e) => setCriticalLevel(e.target.value)}
        />
        <Button type="button" size="sm" variant="secondary" onClick={handleSave}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
