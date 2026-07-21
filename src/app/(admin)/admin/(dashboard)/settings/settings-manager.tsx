"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Locale } from "@/i18n/locales";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import type {
  AdminCallType,
  AdminLocale,
  AdminModule,
  AdminRatingSettings,
  AdminTenantSettings,
  AdminTipPreset,
} from "@/lib/data/adminSettings";
import { TENANT_MODULE_KEYS, type TenantModuleKey } from "@/lib/settings/modules";
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIMEZONES,
  businessSettingsFormSchema,
  callTypeFormSchema,
  orderSettingsFormSchema,
  ratingSettingsFormSchema,
  tipPresetFormSchema,
  type SettingsActionResult,
} from "@/lib/settings/schemas";

type Actions = {
  updateOrderSettings: (input: unknown) => Promise<SettingsActionResult>;
  updateBusinessSettings: (input: unknown) => Promise<SettingsActionResult>;
  createCallType: (input: unknown) => Promise<SettingsActionResult>;
  updateCallType: (callTypeId: string, input: unknown) => Promise<SettingsActionResult>;
  toggleLocale: (input: unknown) => Promise<SettingsActionResult>;
  setDefaultLocale: (locale: string) => Promise<SettingsActionResult>;
  createTipPreset: (input: unknown) => Promise<SettingsActionResult>;
  updateTipPreset: (tipPresetId: string, input: unknown) => Promise<SettingsActionResult>;
  updateRatingSettings: (input: unknown) => Promise<SettingsActionResult>;
  toggleModule: (input: unknown) => Promise<SettingsActionResult>;
};

function OrderSettingsCard({ settings, updateOrderSettings }: { settings: AdminTenantSettings; updateOrderSettings: Actions["updateOrderSettings"] }) {
  const t = useTranslations("admin.settings.order");
  const tErrors = useTranslations("admin.settings.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit } = useForm({
    resolver: standardSchemaResolver(orderSettingsFormSchema),
    defaultValues: { orderMode: settings.orderMode, sessionTimeoutMinutes: settings.sessionTimeoutMinutes },
  });

  async function onSubmit(values: { orderMode: "direct" | "approval"; sessionTimeoutMinutes: number }) {
    setError(null);
    const result = await updateOrderSettings(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label>{t("orderMode")}</Label>
            <Controller
              control={control}
              name="orderMode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">{t("orderModeDirect")}</SelectItem>
                    <SelectItem value="approval">{t("orderModeApproval")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="session-timeout">{t("sessionTimeout")}</Label>
            <Input id="session-timeout" type="number" className="w-32" {...register("sessionTimeoutMinutes")} />
          </div>
          <Button type="submit" size="sm">
            {t("save")}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

function BusinessSettingsCard({
  settings,
  isOwner,
  updateBusinessSettings,
}: {
  settings: AdminTenantSettings;
  isOwner: boolean;
  updateBusinessSettings: Actions["updateBusinessSettings"];
}) {
  const t = useTranslations("admin.settings.business");
  const tErrors = useTranslations("admin.settings.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit } = useForm({
    resolver: standardSchemaResolver(businessSettingsFormSchema),
    defaultValues: {
      currency: settings.currency as (typeof SUPPORTED_CURRENCIES)[number],
      timezone: settings.timezone as (typeof SUPPORTED_TIMEZONES)[number],
    },
  });

  async function onSubmit(values: { currency: string; timezone: string }) {
    setError(null);
    const result = await updateBusinessSettings(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!isOwner && <p className="text-xs text-muted-foreground">{t("ownerOnlyHint")}</p>}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label>{t("currency")}</Label>
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!isOwner}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t("timezone")}</Label>
            <Controller
              control={control}
              name="timezone"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!isOwner}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <Button type="submit" size="sm" disabled={!isOwner}>
            {t("save")}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

function CallTypeRow({ callType, updateCallType }: { callType: AdminCallType; updateCallType: Actions["updateCallType"] }) {
  const t = useTranslations("admin.settings.callTypes");
  const tErrors = useTranslations("admin.settings.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit } = useForm({
    resolver: standardSchemaResolver(callTypeFormSchema),
    defaultValues: { nameTr: callType.nameTr, nameEn: callType.nameEn, isActive: callType.isActive },
  });

  async function onSubmit(values: { nameTr: string; nameEn: string; isActive: boolean }) {
    setError(null);
    const result = await updateCallType(callType.id, values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`call-type-tr-${callType.id}`}>{t("nameTr")}</Label>
        <Input id={`call-type-tr-${callType.id}`} className="w-32" {...register("nameTr")} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`call-type-en-${callType.id}`}>{t("nameEn")}</Label>
        <Input id={`call-type-en-${callType.id}`} className="w-32" {...register("nameEn")} />
      </div>
      <div className="flex items-center gap-2">
        <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
        <Label>{t("active")}</Label>
      </div>
      {callType.isSystem && <Badge variant="secondary">{t("system")}</Badge>}
      <Button type="submit" size="sm">
        {t("save")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

function CallTypesCard({
  callTypes,
  createCallType,
  updateCallType,
}: {
  callTypes: AdminCallType[];
  createCallType: Actions["createCallType"];
  updateCallType: Actions["updateCallType"];
}) {
  const t = useTranslations("admin.settings.callTypes");
  const tErrors = useTranslations("admin.settings.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset } = useForm({
    resolver: standardSchemaResolver(callTypeFormSchema),
    defaultValues: { nameTr: "", nameEn: "", isActive: true },
  });

  async function onSubmit(values: { nameTr: string; nameEn: string; isActive: boolean }) {
    setError(null);
    const result = await createCallType(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    reset({ nameTr: "", nameEn: "", isActive: true });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {callTypes.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        {callTypes.map((callType) => (
          <CallTypeRow key={callType.id} callType={callType} updateCallType={updateCallType} />
        ))}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-call-type-tr">{t("nameTr")}</Label>
            <Input id="new-call-type-tr" className="w-32" {...register("nameTr")} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-call-type-en">{t("nameEn")}</Label>
            <Input id="new-call-type-en" className="w-32" {...register("nameEn")} />
          </div>
          <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          <Button type="submit" size="sm">
            {t("add")}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

function LanguagesCard({
  locales,
  toggleLocale,
  setDefaultLocale,
}: {
  locales: AdminLocale[];
  toggleLocale: Actions["toggleLocale"];
  setDefaultLocale: Actions["setDefaultLocale"];
}) {
  const t = useTranslations("admin.settings.languages");
  const tErrors = useTranslations("admin.settings.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(locale: Locale, isEnabled: boolean) {
    setError(null);
    const result = await toggleLocale({ locale, isEnabled });
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.refresh();
  }

  async function handleSetDefault(locale: Locale) {
    await setDefaultLocale(locale);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {SUPPORTED_LOCALES.map((code) => {
          const entry = locales.find((l) => l.locale === code);
          const isEnabled = Boolean(entry);
          return (
            <div key={code} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{t(code)}</span>
                {entry?.isDefault && <Badge variant="secondary">{t("default")}</Badge>}
              </div>
              <div className="flex items-center gap-2">
                {isEnabled && !entry?.isDefault && (
                  <Button type="button" size="sm" variant="outline" onClick={() => handleSetDefault(code)}>
                    {t("setDefault")}
                  </Button>
                )}
                <Switch checked={isEnabled} onCheckedChange={(checked) => handleToggle(code, checked)} />
              </div>
            </div>
          );
        })}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function TipPresetRow({ preset, updateTipPreset }: { preset: AdminTipPreset; updateTipPreset: Actions["updateTipPreset"] }) {
  const t = useTranslations("admin.settings.tips");
  const tErrors = useTranslations("admin.settings.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit } = useForm({
    resolver: standardSchemaResolver(tipPresetFormSchema),
    defaultValues: { label: preset.label, percentage: preset.percentage, isActive: preset.isActive },
  });

  async function onSubmit(values: { label: string; percentage: number; isActive: boolean }) {
    setError(null);
    const result = await updateTipPreset(preset.id, values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`tip-label-${preset.id}`}>{t("label")}</Label>
        <Input id={`tip-label-${preset.id}`} className="w-28" {...register("label")} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`tip-percentage-${preset.id}`}>{t("percentage")}</Label>
        <Input id={`tip-percentage-${preset.id}`} type="number" className="w-20" {...register("percentage")} />
      </div>
      <div className="flex items-center gap-2">
        <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
        <Label>{t("active")}</Label>
      </div>
      <Button type="submit" size="sm">
        {t("save")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

function TipPresetsCard({
  presets,
  createTipPreset,
  updateTipPreset,
}: {
  presets: AdminTipPreset[];
  createTipPreset: Actions["createTipPreset"];
  updateTipPreset: Actions["updateTipPreset"];
}) {
  const t = useTranslations("admin.settings.tips");
  const tErrors = useTranslations("admin.settings.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset } = useForm({
    resolver: standardSchemaResolver(tipPresetFormSchema),
    defaultValues: { label: "", percentage: 10, isActive: true },
  });

  async function onSubmit(values: { label: string; percentage: number; isActive: boolean }) {
    setError(null);
    const result = await createTipPreset(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    reset({ label: "", percentage: 10, isActive: true });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {presets.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        {presets.map((preset) => (
          <TipPresetRow key={preset.id} preset={preset} updateTipPreset={updateTipPreset} />
        ))}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-tip-label">{t("label")}</Label>
            <Input id="new-tip-label" className="w-28" {...register("label")} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-tip-percentage">{t("percentage")}</Label>
            <Input id="new-tip-percentage" type="number" className="w-20" {...register("percentage")} />
          </div>
          <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          <Button type="submit" size="sm">
            {t("add")}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

function RatingSettingsCard({
  ratingSettings,
  updateRatingSettings,
}: {
  ratingSettings: AdminRatingSettings;
  updateRatingSettings: Actions["updateRatingSettings"];
}) {
  const t = useTranslations("admin.settings.rating");
  const tErrors = useTranslations("admin.settings.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit } = useForm({
    resolver: standardSchemaResolver(ratingSettingsFormSchema),
    defaultValues: { isEnabled: ratingSettings.isEnabled, googleReviewUrl: ratingSettings.googleReviewUrl ?? "" },
  });

  async function onSubmit(values: { isEnabled: boolean; googleReviewUrl: string }) {
    setError(null);
    const result = await updateRatingSettings(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <Controller control={control} name="isEnabled" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
            <Label>{t("enable")}</Label>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="google-review-url">{t("googleUrl")}</Label>
            <Input id="google-review-url" className="w-72" {...register("googleReviewUrl")} />
          </div>
          <Button type="submit" size="sm">
            {t("save")}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

function ThemeCard({ themeKey }: { themeKey: string }) {
  const t = useTranslations("admin.settings.theme");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm">
        <p>
          {t("current")}: <span className="font-medium">{themeKey}</span>
        </p>
        <p className="text-xs text-muted-foreground">{t("comingSoon")}</p>
      </CardContent>
    </Card>
  );
}

function ModulesCard({ modules, toggleModule }: { modules: AdminModule[]; toggleModule: Actions["toggleModule"] }) {
  const t = useTranslations("admin.settings.modules");
  const router = useRouter();

  async function handleToggle(moduleKey: TenantModuleKey, isEnabled: boolean) {
    await toggleModule({ moduleKey, isEnabled });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {TENANT_MODULE_KEYS.map((key) => {
          const isEnabled = modules.find((m) => m.moduleKey === key)?.isEnabled ?? false;
          return (
            <div key={key} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <span>{t(`keys.${key}`)}</span>
              <Switch checked={isEnabled} onCheckedChange={(checked) => handleToggle(key, checked)} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function SettingsManager({
  isOwner,
  settings,
  callTypes,
  locales,
  tipPresets,
  ratingSettings,
  modules,
  actions,
}: {
  isOwner: boolean;
  settings: AdminTenantSettings;
  callTypes: AdminCallType[];
  locales: AdminLocale[];
  tipPresets: AdminTipPreset[];
  ratingSettings: AdminRatingSettings;
  modules: AdminModule[];
  actions: Actions;
}) {
  const t = useTranslations("admin.settings");

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <OrderSettingsCard settings={settings} updateOrderSettings={actions.updateOrderSettings} />
      <BusinessSettingsCard settings={settings} isOwner={isOwner} updateBusinessSettings={actions.updateBusinessSettings} />
      <CallTypesCard callTypes={callTypes} createCallType={actions.createCallType} updateCallType={actions.updateCallType} />
      <LanguagesCard locales={locales} toggleLocale={actions.toggleLocale} setDefaultLocale={actions.setDefaultLocale} />
      <TipPresetsCard presets={tipPresets} createTipPreset={actions.createTipPreset} updateTipPreset={actions.updateTipPreset} />
      <RatingSettingsCard ratingSettings={ratingSettings} updateRatingSettings={actions.updateRatingSettings} />
      <ThemeCard themeKey={settings.themeKey} />
      <ModulesCard modules={modules} toggleModule={actions.toggleModule} />
    </div>
  );
}
