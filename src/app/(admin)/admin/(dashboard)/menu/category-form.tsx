"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { categoryFormSchema, type CategoryFormInput, type MenuActionResult } from "@/lib/menu/schemas";

type CategoryFormValues = {
  layout: "grid" | "list" | "showcase";
  nameTr: string;
  nameEn: string;
  isActive: boolean;
};

export function CategoryForm({
  initial,
  action,
  redirectTo,
}: {
  initial?: CategoryFormValues;
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
  } = useForm<CategoryFormValues>({
    resolver: standardSchemaResolver(categoryFormSchema),
    defaultValues: initial ?? { layout: "grid", nameTr: "", nameEn: "", isActive: true },
  });

  async function onSubmit(values: CategoryFormValues) {
    setServerError(null);
    const parsedForAction: CategoryFormInput = values;
    const result = await action(parsedForAction);

    if (!result.ok) {
      setServerError(t(`errors.${result.error}`));
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="nameTr">{t("category.nameTr")}</Label>
        <Input id="nameTr" {...register("nameTr")} />
        {errors.nameTr && <p className="text-xs text-destructive">{t("errors.required")}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="nameEn">{t("category.nameEn")}</Label>
        <Input id="nameEn" {...register("nameEn")} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="layout">{t("category.layout")}</Label>
        <Controller
          control={control}
          name="layout"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="layout" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">{t("category.layoutGrid")}</SelectItem>
                <SelectItem value="list">{t("category.layoutList")}</SelectItem>
                <SelectItem value="showcase">{t("category.layoutShowcase")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />}
        />
        <Label htmlFor="isActive">{t("category.active")}</Label>
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
