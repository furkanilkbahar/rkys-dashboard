"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  CAMPAIGN_RULE_TYPES,
  campaignFormSchema,
  couponFormSchema,
  type CampaignActionResult,
  type CampaignFormInput,
  type CampaignRuleType,
  type CouponFormInput,
} from "@/lib/campaigns/schemas";
import type { AdminCampaign, AdminCoupon, ProductOption } from "@/lib/data/campaigns";

type Actions = {
  createCampaign: (input: unknown) => Promise<CampaignActionResult>;
  toggleCampaign: (campaignId: string, isActive: boolean) => Promise<CampaignActionResult>;
  deleteCampaign: (campaignId: string) => Promise<CampaignActionResult>;
  createCoupon: (input: unknown) => Promise<CampaignActionResult>;
  toggleCoupon: (couponId: string, isActive: boolean) => Promise<CampaignActionResult>;
  deleteCoupon: (couponId: string) => Promise<CampaignActionResult>;
};

type CategoryOption = { id: string; name: string };

function CampaignsCard({
  campaigns,
  categoryOptions,
  productOptions,
  createCampaign,
  toggleCampaign,
  deleteCampaign,
}: {
  campaigns: AdminCampaign[];
  categoryOptions: CategoryOption[];
  productOptions: ProductOption[];
  createCampaign: Actions["createCampaign"];
  toggleCampaign: Actions["toggleCampaign"];
  deleteCampaign: Actions["deleteCampaign"];
}) {
  const t = useTranslations("admin.campaigns");
  const tErrors = useTranslations("admin.campaigns.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset } = useForm({
    resolver: standardSchemaResolver(campaignFormSchema),
    defaultValues: { name: "", ruleType: "percentage_off" as CampaignRuleType, isActive: true },
  });
  // watch() React Compiler'ı devre dışı bırakıyor (bkz. licenses-manager.tsx/
  // register-form.tsx'teki aynı çözüm) — Controller'ın onChange'i hem
  // react-hook-form state'ini hem bu yerel state'i günceller.
  const [ruleType, setRuleType] = useState<CampaignRuleType>("percentage_off");

  async function onSubmit(values: CampaignFormInput) {
    setError(null);
    const result = await createCampaign(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    reset({ name: "", ruleType: "percentage_off", isActive: true });
    setRuleType("percentage_off");
    router.refresh();
  }

  async function handleToggle(id: string, isActive: boolean) {
    await toggleCampaign(id, isActive);
    router.refresh();
  }

  async function handleDelete(id: string) {
    await deleteCampaign(id);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {campaigns.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        {campaigns.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
            <span>
              {c.name} — {t(`ruleType.${c.ruleType}`)}
            </span>
            <div className="flex items-center gap-2">
              <Switch checked={c.isActive} onCheckedChange={(checked) => handleToggle(c.id, checked)} />
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
                {t("delete")}
              </Button>
            </div>
          </div>
        ))}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="campaign-name">{t("name")}</Label>
              <Input id="campaign-name" className="w-40" {...register("name")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="campaign-rule-type">{t("ruleTypeLabel")}</Label>
              <Controller
                control={control}
                name="ruleType"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value) setRuleType(value as CampaignRuleType);
                    }}
                  >
                    <SelectTrigger id="campaign-rule-type" className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_RULE_TYPES.map((rt) => (
                        <SelectItem key={rt} value={rt}>
                          {t(`ruleType.${rt}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {(ruleType === "percentage_off" || ruleType === "category_discount" || ruleType === "time_window") && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="campaign-percentage">{t("percentage")}</Label>
              <Input id="campaign-percentage" type="number" min={1} max={100} className="w-24" {...register("percentage")} />
            </div>
          )}

          {ruleType === "bogo" && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="campaign-product">{t("product")}</Label>
              <Controller
                control={control}
                name="productId"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="campaign-product" className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {productOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {ruleType === "category_discount" && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="campaign-category">{t("category")}</Label>
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="campaign-category" className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {ruleType === "time_window" && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="campaign-start-hour">{t("startHour")}</Label>
                <Input id="campaign-start-hour" type="number" min={0} max={23} className="w-20" {...register("startHour")} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="campaign-end-hour">{t("endHour")}</Label>
                <Input id="campaign-end-hour" type="number" min={0} max={23} className="w-20" {...register("endHour")} />
              </div>
            </div>
          )}

          <Button type="submit" size="sm" className="w-fit">
            {t("add")}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

function CouponsCard({
  coupons,
  campaigns,
  createCoupon,
  toggleCoupon,
  deleteCoupon,
}: {
  coupons: AdminCoupon[];
  campaigns: AdminCampaign[];
  createCoupon: Actions["createCoupon"];
  toggleCoupon: Actions["toggleCoupon"];
  deleteCoupon: Actions["deleteCoupon"];
}) {
  const t = useTranslations("admin.campaigns.coupons");
  const tErrors = useTranslations("admin.campaigns.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset } = useForm({
    resolver: standardSchemaResolver(couponFormSchema),
    defaultValues: { campaignId: campaigns[0]?.id ?? "", code: "", isActive: true },
  });

  async function onSubmit(values: CouponFormInput) {
    setError(null);
    const result = await createCoupon(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    reset({ campaignId: campaigns[0]?.id ?? "", code: "", isActive: true });
    router.refresh();
  }

  async function handleToggle(id: string, isActive: boolean) {
    await toggleCoupon(id, isActive);
    router.refresh();
  }

  async function handleDelete(id: string) {
    await deleteCoupon(id);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {coupons.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        {coupons.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
            <span>
              {c.code} — {c.campaignName} — {c.usedCount}/{c.usageLimit ?? "∞"}
            </span>
            <div className="flex items-center gap-2">
              <Switch checked={c.isActive} onCheckedChange={(checked) => handleToggle(c.id, checked)} />
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
                {t("delete")}
              </Button>
            </div>
          </div>
        ))}

        {campaigns.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("needCampaign")}</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="coupon-campaign">{t("campaign")}</Label>
              <Controller
                control={control}
                name="campaignId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="coupon-campaign" className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="coupon-code">{t("code")}</Label>
              <Input id="coupon-code" className="w-32 uppercase" {...register("code")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="coupon-usage-limit">{t("usageLimit")}</Label>
              <Input id="coupon-usage-limit" type="number" min={1} className="w-24" {...register("usageLimit")} />
            </div>
            <Button type="submit" size="sm">
              {t("add")}
            </Button>
          </form>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

export function CampaignsManager({
  campaigns,
  coupons,
  categoryOptions,
  productOptions,
  actions,
}: {
  campaigns: AdminCampaign[];
  coupons: AdminCoupon[];
  categoryOptions: CategoryOption[];
  productOptions: ProductOption[];
  actions: Actions;
}) {
  const t = useTranslations("admin.campaigns");

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={t("pageTitle")} />
      <CampaignsCard
        campaigns={campaigns}
        categoryOptions={categoryOptions}
        productOptions={productOptions}
        createCampaign={actions.createCampaign}
        toggleCampaign={actions.toggleCampaign}
        deleteCampaign={actions.deleteCampaign}
      />
      <CouponsCard
        // useForm defaultValues yalnızca ilk mount'ta okunur — kampanya
        // listesi boşken oluşturulup sonradan dolan bir form aksi halde
        // hep boş campaignId ile kalırdı. Liste değişince yeniden mount
        // ederek varsayılanların taze kampanya kümesinden hesaplanmasını sağlar.
        key={campaigns.map((c) => c.id).join(",")}
        coupons={coupons}
        campaigns={campaigns}
        createCoupon={actions.createCoupon}
        toggleCoupon={actions.toggleCoupon}
        deleteCoupon={actions.deleteCoupon}
      />
    </div>
  );
}
