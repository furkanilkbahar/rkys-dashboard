"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { PlatformPageHeader } from "@/components/platform/platform-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ModuleAddonPrice, PlatformPlanDetail } from "@/lib/data/platformPlans";
import { MODULE_KEYS } from "@/lib/modules/keys";
import { planFormSchema, planUpdateFormSchema, type PlatformActionResult } from "@/lib/platform/schemas";

import { createPlan, setPlanModule, updatePlan } from "./actions";

type PlanFormValues = z.input<typeof planFormSchema>;
type PlanUpdateFormValues = z.input<typeof planUpdateFormSchema>;

function formatPriceMinor(priceMinor: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(priceMinor / 100);
}

function PlanModulesGrid({ planId, moduleKeys }: { planId: string; moduleKeys: PlatformPlanDetail["moduleKeys"] }) {
  const t = useTranslations("admin.settings.modules.keys");
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function handleToggle(moduleKey: string, included: boolean) {
    setPendingKey(moduleKey);
    await setPlanModule(planId, moduleKey, included);
    setPendingKey(null);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {MODULE_KEYS.map((key) => (
        <div key={key} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
          <span>{t(key)}</span>
          <Switch
            checked={moduleKeys.includes(key)}
            disabled={pendingKey === key}
            onCheckedChange={(checked) => handleToggle(key, checked)}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * D96 — planın pazarlama ana sayfasındaki fiyat tablosunda görünüp
 * görünmeyeceği. "Satın alınabilir mi?" ile aynı şey DEĞİL: kapalıyken plan
 * kayıt formunda seçilebilir olmayı sürdürür, yalnızca vitrinden çekilir.
 */
function PublicVisibilityField({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const t = useTranslations("platform.plans");

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id}>{t("isPublicLabel")}</Label>
        <p className="text-xs text-muted-foreground">{t("isPublicHint")}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function PlanEditForm({ plan, onDone }: { plan: PlatformPlanDetail; onDone: () => void }) {
  const t = useTranslations("platform.plans");
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: standardSchemaResolver(planUpdateFormSchema),
    defaultValues: {
      name: plan.name,
      priceMinor: plan.priceMinor,
      tableLimit: plan.tableLimit ?? "",
      includedBranchCount: plan.includedBranchCount,
      extraBranchPriceMinor: plan.extraBranchPriceMinor,
      isPublic: plan.isPublic,
    },
  });

  async function onSubmit(values: PlanUpdateFormValues) {
    const result = await updatePlan(plan.id, values);
    if (result.ok) {
      router.refresh();
      onDone();
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`name-${plan.id}`}>{t("nameLabel")}</Label>
        <Input id={`name-${plan.id}`} {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`price-${plan.id}`}>{t("priceLabel")}</Label>
          <Input id={`price-${plan.id}`} type="number" {...register("priceMinor")} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`table-limit-${plan.id}`}>{t("tableLimitLabel")}</Label>
          <Input id={`table-limit-${plan.id}`} type="number" placeholder={t("unlimitedPlaceholder")} {...register("tableLimit")} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`branch-count-${plan.id}`}>{t("includedBranchCountLabel")}</Label>
          <Input id={`branch-count-${plan.id}`} type="number" {...register("includedBranchCount")} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`extra-branch-price-${plan.id}`}>{t("extraBranchPriceLabel")}</Label>
          <Input id={`extra-branch-price-${plan.id}`} type="number" {...register("extraBranchPriceMinor")} />
        </div>
      </div>
      <Controller
        control={control}
        name="isPublic"
        render={({ field }) => (
          <PublicVisibilityField
            id={`is-public-${plan.id}`}
            checked={field.value ?? true}
            onChange={field.onChange}
          />
        )}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting} size="sm">
          {t("save")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

function PlanCard({ plan }: { plan: PlatformPlanDetail }) {
  const t = useTranslations("platform.plans");
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{plan.name}</CardTitle>
          <Badge variant="outline">{plan.key}</Badge>
          {/* Gizli plan listede sessizce durmasın: vitrinde OLMAYAN plan
              istisnadır, rozet yalnızca o durumda çıkar. */}
          {!plan.isPublic && <Badge variant="secondary">{t("hiddenBadge")}</Badge>}
        </div>
        {!isEditing && (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            {t("edit")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isEditing ? (
          <PlanEditForm plan={plan} onDone={() => setIsEditing(false)} />
        ) : (
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">{t("priceLabel")}</dt>
              <dd>{formatPriceMinor(plan.priceMinor)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("tableLimitLabel")}</dt>
              <dd>{plan.tableLimit ?? t("unlimited")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("includedBranchCountLabel")}</dt>
              <dd>{plan.includedBranchCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("extraBranchPriceLabel")}</dt>
              <dd>{formatPriceMinor(plan.extraBranchPriceMinor)}</dd>
            </div>
          </dl>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("modulesTitle")}</h3>
          <PlanModulesGrid planId={plan.id} moduleKeys={plan.moduleKeys} />
        </div>
      </CardContent>
    </Card>
  );
}

function CreatePlanForm() {
  const t = useTranslations("platform.plans");
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: standardSchemaResolver(planFormSchema),
    defaultValues: {
      key: "",
      name: "",
      priceMinor: 0,
      tableLimit: "",
      includedBranchCount: 1,
      extraBranchPriceMinor: 0,
      isPublic: true,
    },
  });

  async function onSubmit(values: PlanFormValues) {
    const result = await createPlan(values);
    if (result.ok) {
      reset();
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("createTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-plan-key">{t("keyLabel")}</Label>
              <Input id="new-plan-key" {...register("key")} />
              {errors.key && <p className="text-xs text-destructive">{errors.key.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-plan-name">{t("nameLabel")}</Label>
              <Input id="new-plan-name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-plan-price">{t("priceLabel")}</Label>
              <Input id="new-plan-price" type="number" {...register("priceMinor")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-plan-table-limit">{t("tableLimitLabel")}</Label>
              <Input id="new-plan-table-limit" type="number" placeholder={t("unlimitedPlaceholder")} {...register("tableLimit")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-plan-branch-count">{t("includedBranchCountLabel")}</Label>
              <Input id="new-plan-branch-count" type="number" {...register("includedBranchCount")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-plan-extra-branch-price">{t("extraBranchPriceLabel")}</Label>
              <Input id="new-plan-extra-branch-price" type="number" {...register("extraBranchPriceMinor")} />
            </div>
          </div>
          <Controller
            control={control}
            name="isPublic"
            render={({ field }) => (
              <PublicVisibilityField
                id="new-plan-is-public"
                checked={field.value ?? true}
                onChange={field.onChange}
              />
            )}
          />
          <Button type="submit" disabled={isSubmitting} className="self-start">
            {t("create")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AddonPriceRow({
  moduleKey,
  priceMinor,
  setModuleAddonPrice,
}: {
  moduleKey: string;
  priceMinor: number;
  setModuleAddonPrice: (moduleKey: string, priceMinor: number) => Promise<PlatformActionResult>;
}) {
  const t = useTranslations("platform.plans");
  const tModules = useTranslations("admin.settings.modules.keys");
  const router = useRouter();
  const [value, setValue] = useState(String(priceMinor / 100));
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const parsedTl = Number(value);
    if (!Number.isFinite(parsedTl) || parsedTl < 0) return;
    setIsSaving(true);
    await setModuleAddonPrice(moduleKey, Math.round(parsedTl * 100));
    setIsSaving(false);
    router.refresh();
  }

  return (
    <div
      data-testid={`addon-price-row-${moduleKey}`}
      className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
    >
      <span>{tModules(moduleKey)}</span>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="0"
          step="1"
          className="w-28"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button size="sm" disabled={isSaving} onClick={handleSave}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

function AddonPricingCard({
  addonPrices,
  setModuleAddonPrice,
}: {
  addonPrices: ModuleAddonPrice[];
  setModuleAddonPrice: (moduleKey: string, priceMinor: number) => Promise<PlatformActionResult>;
}) {
  const t = useTranslations("platform.plans");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("addonPricingTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("addonPricingSubtitle")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {addonPrices.map((addon) => (
          <AddonPriceRow
            key={addon.moduleKey}
            moduleKey={addon.moduleKey}
            priceMinor={addon.priceMinor}
            setModuleAddonPrice={setModuleAddonPrice}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export function PlansManager({
  plans,
  addonPrices,
  setModuleAddonPrice,
}: {
  plans: PlatformPlanDetail[];
  addonPrices: ModuleAddonPrice[];
  setModuleAddonPrice: (moduleKey: string, priceMinor: number) => Promise<PlatformActionResult>;
}) {
  const t = useTranslations("platform.plans");

  return (
    <div className="flex flex-col gap-6">
      <PlatformPageHeader title={t("title")} />

      <div className="flex flex-col gap-4">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>

      <CreatePlanForm />

      <AddonPricingCard addonPrices={addonPrices} setModuleAddonPrice={setModuleAddonPrice} />
    </div>
  );
}
