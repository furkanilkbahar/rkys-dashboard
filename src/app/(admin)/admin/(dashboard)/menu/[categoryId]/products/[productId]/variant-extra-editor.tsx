"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { extraFormSchema, variantFormSchema, type MenuActionResult } from "@/lib/menu/schemas";

type ItemValues = {
  productId: string;
  price: string;
  stockQuantity: string;
  isSoldOut: boolean;
  isActive: boolean;
  nameTr: string;
  nameEn: string;
};

type Item = {
  id: string;
  priceMinor: number;
  stockQuantity: number | null;
  isSoldOut: boolean;
  isActive: boolean;
  name: { tr: string; en: string };
};

function toMajor(priceMinor: number): string {
  return (priceMinor / 100).toFixed(2);
}

function ItemForm({
  kind,
  productId,
  item,
  createAction,
  updateAction,
}: {
  kind: "variant" | "extra";
  productId: string;
  item?: Item;
  createAction: (input: unknown) => Promise<MenuActionResult>;
  updateAction: (id: string, input: unknown) => Promise<MenuActionResult>;
}) {
  const t = useTranslations(`admin.menu.${kind}`);
  const tErrors = useTranslations("admin.menu.errors");
  const tCommon = useTranslations("admin.common");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const schema = kind === "variant" ? variantFormSchema : extraFormSchema;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ItemValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: item
      ? {
          productId,
          price: toMajor(item.priceMinor),
          stockQuantity: item.stockQuantity === null ? "" : String(item.stockQuantity),
          isSoldOut: item.isSoldOut,
          isActive: item.isActive,
          nameTr: item.name.tr,
          nameEn: item.name.en,
        }
      : { productId, price: "", stockQuantity: "", isSoldOut: false, isActive: true, nameTr: "", nameEn: "" },
  });

  async function onSubmit(values: ItemValues) {
    setServerError(null);
    const result = item ? await updateAction(item.id, values) : await createAction(values);

    if (!result.ok) {
      setServerError(tErrors(result.error));
      return;
    }

    if (!item) {
      reset({ productId, price: "", stockQuantity: "", isSoldOut: false, isActive: true, nameTr: "", nameEn: "" });
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder={t("nameTr")} {...register("nameTr")} />
        <Input placeholder={t("nameEn")} {...register("nameEn")} />
      </div>
      {errors.nameTr && <p className="text-xs text-destructive">{tErrors("required")}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder={t("price")} inputMode="decimal" {...register("price")} />
        <Input placeholder={t("stock")} inputMode="numeric" {...register("stockQuantity")} />
      </div>
      {errors.price && <p className="text-xs text-destructive">{tErrors("invalid_price")}</p>}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="isSoldOut"
            render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
          />
          <Label>{t("soldOut")}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
          />
          <Label>{t("active")}</Label>
        </div>
      </div>
      {serverError && <p className="text-xs text-destructive">{serverError}</p>}
      <Button type="submit" size="sm" variant={item ? "outline" : "default"} disabled={isSubmitting} className="self-start">
        {item ? tCommon("save") : t("add")}
      </Button>
    </form>
  );
}

export function VariantExtraEditor({
  kind,
  productId,
  items,
  createAction,
  updateAction,
}: {
  kind: "variant" | "extra";
  productId: string;
  items: Item[];
  createAction: (input: unknown) => Promise<MenuActionResult>;
  updateAction: (id: string, input: unknown) => Promise<MenuActionResult>;
}) {
  const t = useTranslations(`admin.menu.${kind}`);

  return (
    <div className="flex flex-col gap-3" data-testid={`${kind}-editor`}>
      <h3 className="text-sm font-semibold">{t("title")}</h3>
      {items.length === 0 && <p className="text-xs text-muted-foreground">{t("empty")}</p>}
      {items.map((item) => (
        <ItemForm
          key={item.id}
          kind={kind}
          productId={productId}
          item={item}
          createAction={createAction}
          updateAction={updateAction}
        />
      ))}
      <ItemForm kind={kind} productId={productId} createAction={createAction} updateAction={updateAction} />
    </div>
  );
}
