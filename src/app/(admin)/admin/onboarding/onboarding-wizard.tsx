"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ImageUploader } from "@/components/admin/image-uploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";
import type { ImageActionResult } from "@/lib/menu/schemas";
import type { AdminTheme } from "@/lib/data/adminSettings";
import { MODULE_KEYS, type ModuleKey } from "@/lib/modules/keys";
import { SUPPORTED_CURRENCIES, type SettingsActionResult } from "@/lib/settings/schemas";

type Actions = {
  clearDemoData: () => Promise<SettingsActionResult>;
  applyMenuTemplate: () => Promise<SettingsActionResult>;
  createOnboardingTables: (branchId: string, count: number) => Promise<SettingsActionResult>;
  uploadTenantLogo: (formData: FormData) => Promise<ImageActionResult>;
  completeOnboarding: () => Promise<SettingsActionResult>;
  toggleLocale: (input: unknown) => Promise<SettingsActionResult>;
  toggleModule: (input: unknown) => Promise<SettingsActionResult>;
  updateBusinessSettings: (input: unknown) => Promise<SettingsActionResult>;
  updateTheme: (input: unknown) => Promise<SettingsActionResult>;
};

const STEPS = ["logo", "language", "currency", "tables", "menu", "modules", "theme"] as const;
type Step = (typeof STEPS)[number];

export function OnboardingWizard({
  isOwner,
  branchId,
  themes,
  themeKey,
  actions,
}: {
  isOwner: boolean;
  branchId: string;
  themes: AdminTheme[];
  themeKey: string;
  actions: Actions;
}) {
  const t = useTranslations("admin.onboarding");
  const router = useRouter();
  const [screen, setScreen] = useState<"entry" | "wizard">("entry");
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState(themeKey);
  const step: Step = STEPS[stepIndex];

  async function handleThemeChange(value: string | null) {
    if (!value || value === selectedTheme) return;
    const result = await actions.updateTheme({ themeKey: value });
    if (result.ok) {
      setSelectedTheme(value);
      // data-theme root layout'ta SSR header'ından okunuyor (bkz. proxy.ts) —
      // canlı önizleme için tam bir sunucu round-trip'i gerekir.
      router.refresh();
    }
  }

  async function handleExploreWithDemo() {
    await actions.completeOnboarding();
    router.push("/admin");
  }

  async function handleStartFresh() {
    await actions.clearDemoData();
    setScreen("wizard");
  }

  async function handleFinish() {
    await actions.completeOnboarding();
    router.push("/admin");
  }

  if (screen === "entry") {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>{t("entry.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{t("entry.body")}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="outline" className="flex-1" onClick={handleExploreWithDemo}>
                {t("entry.exploreDemo")}
              </Button>
              <Button type="button" className="flex-1" onClick={handleStartFresh}>
                {t("entry.startFresh")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 p-6">
      <p className="text-xs text-muted-foreground">{t("stepCounter", { current: stepIndex + 1, total: STEPS.length })}</p>

      {step === "logo" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("logo.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUploader currentUrl={null} uploadAction={actions.uploadTenantLogo} />
          </CardContent>
        </Card>
      )}

      {step === "language" && <LanguageStep t={t} toggleLocale={actions.toggleLocale} />}

      {step === "currency" && isOwner && <CurrencyStep t={t} updateBusinessSettings={actions.updateBusinessSettings} />}
      {step === "currency" && !isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>{t("currency.title")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{t("currency.ownerOnlyHint")}</CardContent>
        </Card>
      )}

      {step === "tables" && <TablesStep t={t} branchId={branchId} createOnboardingTables={actions.createOnboardingTables} />}

      {step === "menu" && <MenuTemplateStep t={t} applyMenuTemplate={actions.applyMenuTemplate} />}

      {step === "modules" && <ModulesStep t={t} toggleModule={actions.toggleModule} />}

      {step === "theme" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("theme.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <Select value={selectedTheme} onValueChange={handleThemeChange}>
              <SelectTrigger className="w-full" aria-label={t("theme.title")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {themes.map((theme) => (
                  <SelectItem key={theme.key} value={theme.key}>
                    {theme.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
        >
          {t("back")}
        </Button>
        {stepIndex < STEPS.length - 1 ? (
          <Button type="button" size="sm" onClick={() => setStepIndex((i) => i + 1)}>
            {t("next")}
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={handleFinish}>
            {t("finish")}
          </Button>
        )}
      </div>
    </main>
  );
}

function LanguageStep({
  t,
  toggleLocale,
}: {
  t: ReturnType<typeof useTranslations>;
  toggleLocale: Actions["toggleLocale"];
}) {
  const [enabled, setEnabled] = useState<Locale[]>(["tr"]);

  async function handleToggle(locale: Locale, checked: boolean) {
    const result = await toggleLocale({ locale, isEnabled: checked });
    if (!result.ok) return;
    setEnabled((prev) => (checked ? [...prev, locale] : prev.filter((l) => l !== locale)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("language.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {SUPPORTED_LOCALES.map((locale) => (
          <div key={locale} className="flex items-center justify-between gap-2 text-sm">
            <Label>{t(`language.${locale}`)}</Label>
            <Switch
              checked={enabled.includes(locale)}
              onCheckedChange={(checked) => handleToggle(locale, checked)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CurrencyStep({
  t,
  updateBusinessSettings,
}: {
  t: ReturnType<typeof useTranslations>;
  updateBusinessSettings: Actions["updateBusinessSettings"];
}) {
  const [currency, setCurrency] = useState<(typeof SUPPORTED_CURRENCIES)[number]>("TRY");
  const [saved, setSaved] = useState(false);

  async function handleChange(value: string | null) {
    if (!value) return;
    setCurrency(value as (typeof SUPPORTED_CURRENCIES)[number]);
    const result = await updateBusinessSettings({ currency: value, timezone: "Europe/Istanbul" });
    setSaved(result.ok);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("currency.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Select value={currency} onValueChange={handleChange}>
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
        {saved && <p className="text-xs text-muted-foreground">{t("saved")}</p>}
      </CardContent>
    </Card>
  );
}

function TablesStep({
  t,
  branchId,
  createOnboardingTables,
}: {
  t: ReturnType<typeof useTranslations>;
  branchId: string;
  createOnboardingTables: Actions["createOnboardingTables"];
}) {
  const [count, setCount] = useState("4");
  const [status, setStatus] = useState<"idle" | "created">("idle");

  async function handleCreate() {
    const parsed = parseInt(count, 10);
    if (Number.isNaN(parsed)) return;
    const result = await createOnboardingTables(branchId, parsed);
    if (result.ok) setStatus("created");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("tables.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="onboarding-table-count">{t("tables.count")}</Label>
          <Input
            id="onboarding-table-count"
            type="number"
            className="w-24"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </div>
        <Button type="button" size="sm" onClick={handleCreate} disabled={status === "created"}>
          {status === "created" ? t("tables.created") : t("tables.create")}
        </Button>
      </CardContent>
    </Card>
  );
}

function MenuTemplateStep({
  t,
  applyMenuTemplate,
}: {
  t: ReturnType<typeof useTranslations>;
  applyMenuTemplate: Actions["applyMenuTemplate"];
}) {
  const [status, setStatus] = useState<"idle" | "applied">("idle");

  async function handleApply() {
    const result = await applyMenuTemplate();
    if (result.ok) setStatus("applied");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("menu.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{t("menu.body")}</p>
        <Button type="button" size="sm" onClick={handleApply} disabled={status === "applied"} className="w-fit">
          {status === "applied" ? t("menu.applied") : t("menu.apply")}
        </Button>
      </CardContent>
    </Card>
  );
}

function ModulesStep({
  t,
  toggleModule,
}: {
  t: ReturnType<typeof useTranslations>;
  toggleModule: Actions["toggleModule"];
}) {
  const tModuleKeys = useTranslations("admin.settings.modules.keys");
  const [enabled, setEnabled] = useState<Set<ModuleKey>>(new Set());

  async function handleToggle(moduleKey: ModuleKey, checked: boolean) {
    const result = await toggleModule({ moduleKey, isEnabled: checked });
    if (!result.ok) return;
    setEnabled((prev) => {
      const next = new Set(prev);
      if (checked) next.add(moduleKey);
      else next.delete(moduleKey);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("modules.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex max-h-72 flex-col gap-2 overflow-y-auto">
        {MODULE_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between gap-2 text-sm">
            <span>{tModuleKeys(key)}</span>
            <Switch checked={enabled.has(key)} onCheckedChange={(checked) => handleToggle(key, checked)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
