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
import { Textarea } from "@/components/ui/textarea";
import { productFormSchema, type MenuActionResult } from "@/lib/menu/schemas";

type ProductFormValues = {
  categoryId: string;
  basePrice: string;
  stockQuantity: string;
  isSoldOut: boolean;
  isActive: boolean;
  nameTr: string;
  nameEn: string;
  descriptionTr: string;
  descriptionEn: string;
};

function toMajor(priceMinor: number): string {
  return (priceMinor / 100).toFixed(2);
}

export function ProductForm({
  categoryId,
  initial,
  action,
  redirectTo,
}: {
  categoryId: string;
  initial?: {
    basePriceMinor: number;
    stockQuantity: number | null;
    isSoldOut: boolean;
    isActive: boolean;
    nameTr: string;
    nameEn: string;
    descriptionTr: string;
    descriptionEn: string;
  };
  action: (input: unknown) => Promise<MenuActionResult>;
  redirectTo: string;
}) {
  const t = useTranslations("admin.menu");
  const tCommon = useTranslations("admin.common");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: standardSchemaResolver(productFormSchema),
    defaultValues: initial
      ? {
          categoryId,
          basePrice: toMajor(initial.basePriceMinor),
          stockQuantity: initial.stockQuantity === null ? "" : String(initial.stockQuantity),
          isSoldOut: initial.isSoldOut,
          isActive: initial.isActive,
          nameTr: initial.nameTr,
          nameEn: initial.nameEn,
          descriptionTr: initial.descriptionTr,
          descriptionEn: initial.descriptionEn,
        }
      : {
          categoryId,
          basePrice: "",
          stockQuantity: "",
          isSoldOut: false,
          isActive: true,
          nameTr: "",
          nameEn: "",
          descriptionTr: "",
          descriptionEn: "",
        },
  });

  async function onSubmit(values: ProductFormValues) {
    setServerError(null);
    const result = await action(values);

    if (!result.ok) {
      setServerError(t(`errors.${result.error}`));
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <input type="hidden" {...register("categoryId")} />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="nameTr">{t("product.nameTr")}</Label>
          <Input id="nameTr" {...register("nameTr")} />
          {errors.nameTr && <p className="text-xs text-destructive">{t("errors.required")}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="nameEn">{t("product.nameEn")}</Label>
          <Input id="nameEn" {...register("nameEn")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="descriptionTr">{t("product.descriptionTr")}</Label>
          <Textarea id="descriptionTr" rows={2} {...register("descriptionTr")} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="descriptionEn">{t("product.descriptionEn")}</Label>
          <Textarea id="descriptionEn" rows={2} {...register("descriptionEn")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="basePrice">{t("product.price")}</Label>
          <Input id="basePrice" inputMode="decimal" placeholder="45.00" {...register("basePrice")} />
          {errors.basePrice && <p className="text-xs text-destructive">{t("errors.invalid_price")}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="stockQuantity">{t("product.stock")}</Label>
          <Input id="stockQuantity" inputMode="numeric" {...register("stockQuantity")} />
          <p className="text-xs text-muted-foreground">{t("product.stockUnlimitedHint")}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="isSoldOut"
          render={({ field }) => <Switch id="isSoldOut" checked={field.value} onCheckedChange={field.onChange} />}
        />
        <Label htmlFor="isSoldOut">{t("product.soldOut")}</Label>
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />}
        />
        <Label htmlFor="isActive">{t("product.active")}</Label>
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
