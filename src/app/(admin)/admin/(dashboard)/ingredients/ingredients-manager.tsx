"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DataTable, DataTableActions } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminIngredient } from "@/lib/data/ingredients";
import type { AdminSupplier } from "@/lib/data/suppliers";
import {
  countFormSchema,
  INGREDIENT_UNITS,
  ingredientFormSchema,
  purchaseFormSchema,
  wasteFormSchema,
  type InventoryActionResult,
} from "@/lib/inventory/schemas";

type IngredientFormValues = z.input<typeof ingredientFormSchema>;
type PurchaseFormValues = z.input<typeof purchaseFormSchema>;
type WasteFormValues = z.input<typeof wasteFormSchema>;
type CountFormValues = z.input<typeof countFormSchema>;

export function IngredientsManager({
  ingredients,
  suppliers,
  createIngredient,
  updateIngredient,
  recordPurchase,
  recordWaste,
  recordCount,
}: {
  ingredients: AdminIngredient[];
  suppliers: AdminSupplier[];
  createIngredient: (input: unknown) => Promise<InventoryActionResult>;
  updateIngredient: (ingredientId: string, input: unknown) => Promise<InventoryActionResult>;
  recordPurchase: (input: unknown) => Promise<InventoryActionResult>;
  recordWaste: (input: unknown) => Promise<InventoryActionResult>;
  recordCount: (input: unknown) => Promise<InventoryActionResult>;
}) {
  const t = useTranslations("admin.ingredients");
  const tGrid = useTranslations("admin.table");
  const tErrors = useTranslations("admin.ingredients.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Hangi satırın hangi paneli açık — durum SATIRIN İÇİNDE değil burada,
  // çünkü satırları artık DataTable render ediyor ve aynı anda yalnızca bir
  // panelin açık olması zaten istenen davranış.
  const [openPanel, setOpenPanel] = useState<{ id: string; panel: Exclude<Panel, null> } | null>(null);
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

  const criticalIngredients = ingredients.filter((i) => i.currentStock <= i.criticalLevel);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={t("pageTitle")} />
      {criticalIngredients.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("criticalSummary", { count: criticalIngredients.length, names: criticalIngredients.map((i) => i.name).join(", ") })}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            rows={ingredients}
            rowKey={(ingredient) => ingredient.id}
            // Locator yüzeyi: stock-purchase-waste-count.spec.ts satırı
            // eskiden `getByText("Un").locator("../../..")` ile DOM tırmanarak
            // buluyordu — işaretleme değişince kırılan cinsten. Kararlı bir
            // testid, tabloda da kart modunda da aynı satırı gösterir.
            rowAttributes={(ingredient) => ({ "data-testid": `ingredient-row-${ingredient.id}` })}
            empty={t("empty")}
            searchable
            initialSort={{ key: "name" }}
            expandedRow={(ingredient) =>
              openPanel?.id !== ingredient.id ? null : openPanel.panel === "purchase" ? (
                <PurchaseForm
                  ingredientId={ingredient.id}
                  suppliers={suppliers}
                  recordPurchase={recordPurchase}
                  onDone={() => setOpenPanel(null)}
                />
              ) : openPanel.panel === "waste" ? (
                <WasteForm ingredientId={ingredient.id} recordWaste={recordWaste} onDone={() => setOpenPanel(null)} />
              ) : (
                <CountForm
                  ingredientId={ingredient.id}
                  currentStock={ingredient.currentStock}
                  recordCount={recordCount}
                  onDone={() => setOpenPanel(null)}
                />
              )
            }
            columns={[
              {
                key: "name",
                header: t("name"),
                primary: true,
                value: (ingredient) => ingredient.name,
                cell: (ingredient) => (
                  <span className="flex flex-wrap items-center gap-1.5">
                    {/* Ad KENDİ öğesinde durmalı: ingredients-recipe.spec.ts
                        `getByText("Süt", { exact: true })` ile arıyor ve
                        `exact` öğenin TAM metnine bakar — adı birim/rozet ile
                        aynı kutuya koymak eşleşmeyi bozuyordu. */}
                    <span>{ingredient.name}</span>
                    <span className="text-[11px] text-[var(--surface-fg-faint)]">({ingredient.unit})</span>
                    {ingredient.currentStock <= ingredient.criticalLevel && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10.5px] font-medium"
                        style={{
                          color: "var(--sem-err-fg)",
                          backgroundColor: "color-mix(in oklch, var(--sem-err) 12%, transparent)",
                        }}
                      >
                        {t("criticalBadge")}
                      </span>
                    )}
                  </span>
                ),
              },
              {
                key: "stock",
                header: t("stock"),
                align: "end",
                value: (ingredient) => ingredient.currentStock,
                cell: (ingredient) => <span className="tabular-nums">{ingredient.currentStock}</span>,
              },
              {
                key: "critical",
                header: t("criticalLevel"),
                align: "end",
                value: (ingredient) => ingredient.criticalLevel,
                cell: (ingredient) => (
                  <CriticalLevelCell ingredient={ingredient} updateIngredient={updateIngredient} />
                ),
              },
              {
                key: "actions",
                header: tGrid("actions"),
                actions: true,
                align: "end",
                cell: (ingredient) => (
                  <DataTableActions>
                    {(["purchase", "waste", "count"] as const).map((panel) => (
                      <Button
                        key={panel}
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-expanded={openPanel?.id === ingredient.id && openPanel.panel === panel}
                        onClick={() =>
                          setOpenPanel((current) =>
                            current?.id === ingredient.id && current.panel === panel
                              ? null
                              : { id: ingredient.id, panel },
                          )
                        }
                      >
                        {t(`${panel}.toggle`)}
                      </Button>
                    ))}
                  </DataTableActions>
                ),
              },
            ]}
          />

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

type Panel = "purchase" | "waste" | "count" | null;

/**
 * Kritik seviye hücresi — düzenlenebilir tek alan, kendi taslak durumuyla.
 *
 * Ayrı bir bileşen olmak ZORUNDA: durumu `IngredientsManager` içinde tutmak
 * her satır için ayrı bir state gerektirirdi. Kimliği `<tr key>` sabit
 * olduğu için sıralama/filtre değiştiğinde yazılan değer kaybolmaz.
 *
 * Görünür `<Label>` yerine `aria-label`: tabloda kolon başlığı zaten
 * "Kritik Seviye" yazıyor, satır başına bir etiket daha basmak hem görsel
 * tekrar olurdu hem de `getByLabel("Kritik Seviye")`'yi N+1 öğeye düşürüp
 * ekleme formundaki alanı bulunamaz hâle getirirdi. Malzeme adını içeren
 * etiket aynı zamanda daha iyi bir ekran okuyucu deneyimi.
 */
function CriticalLevelCell({
  ingredient,
  updateIngredient,
}: {
  ingredient: AdminIngredient;
  updateIngredient: (ingredientId: string, input: unknown) => Promise<InventoryActionResult>;
}) {
  const t = useTranslations("admin.ingredients");
  const router = useRouter();
  const [criticalLevel, setCriticalLevel] = useState(String(ingredient.criticalLevel));
  const isDirty = criticalLevel !== String(ingredient.criticalLevel);

  async function handleSave() {
    await updateIngredient(ingredient.id, { name: ingredient.name, unit: ingredient.unit, criticalLevel });
    router.refresh();
  }

  return (
    <span className="flex items-center justify-end gap-1.5">
      <Input
        aria-label={t("criticalLevelFor", { name: ingredient.name })}
        className="w-20 text-right"
        inputMode="decimal"
        value={criticalLevel}
        onChange={(event) => setCriticalLevel(event.target.value)}
      />
      {/* Kaydet yalnızca DEĞİŞİKLİK varken çıkar — 8 malzemede 8 boş
          "Kaydet" butonu, tablodaki asıl işlemleri gölgeliyordu. */}
      {isDirty && (
        <Button type="button" size="sm" variant="secondary" onClick={handleSave}>
          {t("save")}
        </Button>
      )}
    </span>
  );
}

function PurchaseForm({
  ingredientId,
  suppliers,
  recordPurchase,
  onDone,
}: {
  ingredientId: string;
  suppliers: AdminSupplier[];
  recordPurchase: (input: unknown) => Promise<InventoryActionResult>;
  onDone: () => void;
}) {
  const t = useTranslations("admin.ingredients.purchase");
  const tErrors = useTranslations("admin.ingredients.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit } = useForm({
    resolver: standardSchemaResolver(purchaseFormSchema),
    defaultValues: { ingredientId, supplierId: "", quantity: "1", unitCost: "" },
  });

  async function onSubmit(values: PurchaseFormValues) {
    setError(null);
    const result = await recordPurchase(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2 border-t border-border pt-2">
      <input type="hidden" {...register("ingredientId")} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`purchase-qty-${ingredientId}`}>{t("quantity")}</Label>
        <Input id={`purchase-qty-${ingredientId}`} className="w-20" inputMode="decimal" {...register("quantity")} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`purchase-cost-${ingredientId}`}>{t("unitCost")}</Label>
        <Input id={`purchase-cost-${ingredientId}`} className="w-24" inputMode="decimal" placeholder="0.00" {...register("unitCost")} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`purchase-supplier-${ingredientId}`}>{t("supplier")}</Label>
        <Controller
          control={control}
          name="supplierId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id={`purchase-supplier-${ingredientId}`} aria-label={t("supplier")} className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t("supplierNone")}</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <Button type="submit" size="sm">
        {t("save")}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        {t("cancel")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

function WasteForm({
  ingredientId,
  recordWaste,
  onDone,
}: {
  ingredientId: string;
  recordWaste: (input: unknown) => Promise<InventoryActionResult>;
  onDone: () => void;
}) {
  const t = useTranslations("admin.ingredients.waste");
  const tErrors = useTranslations("admin.ingredients.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit } = useForm({
    resolver: standardSchemaResolver(wasteFormSchema),
    defaultValues: { ingredientId, quantity: "1", note: "" },
  });

  async function onSubmit(values: WasteFormValues) {
    setError(null);
    const result = await recordWaste(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2 border-t border-border pt-2">
      <input type="hidden" {...register("ingredientId")} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`waste-qty-${ingredientId}`}>{t("quantity")}</Label>
        <Input id={`waste-qty-${ingredientId}`} className="w-20" inputMode="decimal" {...register("quantity")} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`waste-note-${ingredientId}`}>{t("note")}</Label>
        <Input id={`waste-note-${ingredientId}`} className="w-48" {...register("note")} />
      </div>
      <Button type="submit" size="sm">
        {t("save")}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        {t("cancel")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

function CountForm({
  ingredientId,
  currentStock,
  recordCount,
  onDone,
}: {
  ingredientId: string;
  currentStock: number;
  recordCount: (input: unknown) => Promise<InventoryActionResult>;
  onDone: () => void;
}) {
  const t = useTranslations("admin.ingredients.count");
  const tErrors = useTranslations("admin.ingredients.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit } = useForm({
    resolver: standardSchemaResolver(countFormSchema),
    defaultValues: { ingredientId, countedQuantity: String(currentStock) },
  });

  async function onSubmit(values: CountFormValues) {
    setError(null);
    const result = await recordCount(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2 border-t border-border pt-2">
      <input type="hidden" {...register("ingredientId")} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`count-qty-${ingredientId}`}>{t("countedQuantity")}</Label>
        <Input id={`count-qty-${ingredientId}`} className="w-24" inputMode="decimal" {...register("countedQuantity")} />
      </div>
      <Button type="submit" size="sm">
        {t("save")}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        {t("cancel")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
