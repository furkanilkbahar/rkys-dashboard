import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/locales";
import type { TenantModuleKey } from "@/lib/settings/modules";

export type AdminTenantSettings = {
  currency: string;
  timezone: string;
  orderMode: "direct" | "approval";
  sessionTimeoutMinutes: number;
  themeKey: string;
};

export type AdminCallType = {
  id: string;
  key: string;
  isSystem: boolean;
  isActive: boolean;
  nameTr: string;
  nameEn: string;
};

export type AdminTipPreset = {
  id: string;
  label: string;
  percentage: number;
  isActive: boolean;
};

export type AdminRatingSettings = {
  isEnabled: boolean;
  googleReviewUrl: string | null;
};

export type AdminLocale = {
  locale: Locale;
  isDefault: boolean;
};

export type AdminModule = {
  moduleKey: TenantModuleKey;
  isEnabled: boolean;
};

export async function getAdminTenantSettings(tenantId: string): Promise<AdminTenantSettings | null> {
  const supabase = await createClient();
  const [{ data: tenant }, { data: settings }] = await Promise.all([
    supabase.from("tenants").select("currency, timezone").eq("id", tenantId).single(),
    supabase
      .from("tenant_settings")
      .select("order_mode, session_timeout_minutes, theme_key")
      .eq("tenant_id", tenantId)
      .single(),
  ]);

  if (!tenant || !settings) {
    return null;
  }

  return {
    currency: tenant.currency,
    timezone: tenant.timezone,
    orderMode: settings.order_mode as "direct" | "approval",
    sessionTimeoutMinutes: settings.session_timeout_minutes,
    themeKey: settings.theme_key,
  };
}

export async function getAdminCallTypes(tenantId: string): Promise<AdminCallType[]> {
  const supabase = await createClient();
  const { data: callTypes } = await supabase
    .from("call_types")
    .select("id, key, is_system, is_active")
    .eq("tenant_id", tenantId)
    .order("display_order");

  if (!callTypes || callTypes.length === 0) {
    return [];
  }

  const { data: translations } = await supabase
    .from("content_translations")
    .select("entity_id, locale, value")
    .eq("entity_type", "call_type")
    .eq("field", "name")
    .in(
      "entity_id",
      callTypes.map((c) => c.id),
    );

  const nameFor = (entityId: string, l: Locale) =>
    translations?.find((t) => t.entity_id === entityId && t.locale === l)?.value ?? "";

  return callTypes.map((c) => ({
    id: c.id,
    key: c.key,
    isSystem: c.is_system,
    isActive: c.is_active,
    nameTr: nameFor(c.id, "tr"),
    nameEn: nameFor(c.id, "en"),
  }));
}

export async function getAdminTipPresets(tenantId: string): Promise<AdminTipPreset[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tip_presets")
    .select("id, label, percentage, is_active")
    .eq("tenant_id", tenantId)
    .order("display_order");

  return (data ?? []).map((p) => ({
    id: p.id,
    label: p.label,
    percentage: p.percentage,
    isActive: p.is_active,
  }));
}

export async function getAdminRatingSettings(tenantId: string): Promise<AdminRatingSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rating_settings")
    .select("is_enabled, google_review_url")
    .eq("tenant_id", tenantId)
    .single();

  if (!data) {
    return null;
  }

  return { isEnabled: data.is_enabled, googleReviewUrl: data.google_review_url };
}

export async function getAdminLocales(tenantId: string): Promise<AdminLocale[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_locales")
    .select("locale, is_default")
    .eq("tenant_id", tenantId);

  return (data ?? []).map((l) => ({ locale: l.locale as Locale, isDefault: l.is_default }));
}

export async function getAdminModules(tenantId: string): Promise<AdminModule[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("tenant_modules").select("module_key, is_enabled").eq("tenant_id", tenantId);

  return (data ?? []).map((m) => ({ moduleKey: m.module_key as TenantModuleKey, isEnabled: m.is_enabled }));
}
