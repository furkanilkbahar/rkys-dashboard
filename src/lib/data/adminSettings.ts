import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/locales";
import { MODULE_KEYS, type ModuleKey } from "@/lib/modules/keys";

export type AdminTenantSettings = {
  currency: string;
  timezone: string;
  orderMode: "direct" | "approval";
  sessionTimeoutMinutes: number;
  themeKey: string;
  deletionRequestedAt: string | null;
};

export type AdminCallType = {
  id: string;
  key: string;
  isSystem: boolean;
  isActive: boolean;
  nameTr: string;
  nameEn: string;
};

export type AdminReasonCode = {
  id: string;
  category: "comp" | "refund" | "cancel" | "campaign";
  key: string;
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
  moduleKey: ModuleKey;
  isEnabled: boolean;
  pendingRemovalSince: string | null;
  isIncludedInPlan: boolean;
  hasPendingRequest: boolean;
  // null = tenant_modules'ta hiç satırı yok (hiç sahip olunmadı) — bu ve
  // isIncludedInPlan=false birlikteyse UI kilitli/"Talep Et" gösterir.
  source: "plan" | "paid_addon" | "granted" | null;
};

export async function getAdminTenantSettings(tenantId: string): Promise<AdminTenantSettings | null> {
  const supabase = await createClient();
  const [{ data: tenant }, { data: settings }] = await Promise.all([
    supabase.from("tenants").select("currency, timezone, deletion_requested_at").eq("id", tenantId).single(),
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
    deletionRequestedAt: tenant.deletion_requested_at,
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

export async function getAdminReasonCodes(tenantId: string): Promise<AdminReasonCode[]> {
  const supabase = await createClient();
  const { data: reasonCodes } = await supabase
    .from("reason_codes")
    .select("id, category, key, is_active")
    .eq("tenant_id", tenantId)
    .order("display_order");

  if (!reasonCodes || reasonCodes.length === 0) {
    return [];
  }

  const { data: translations } = await supabase
    .from("content_translations")
    .select("entity_id, locale, value")
    .eq("entity_type", "reason_code")
    .eq("field", "name")
    .in(
      "entity_id",
      reasonCodes.map((r) => r.id),
    );

  const nameFor = (entityId: string, l: Locale) =>
    translations?.find((t) => t.entity_id === entityId && t.locale === l)?.value ?? "";

  return reasonCodes.map((r) => ({
    id: r.id,
    category: r.category as "comp" | "refund" | "cancel",
    key: r.key,
    isActive: r.is_active,
    nameTr: nameFor(r.id, "tr"),
    nameEn: nameFor(r.id, "en"),
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
  const [{ data: modules }, { data: tenant }, { data: pendingRequests }] = await Promise.all([
    supabase.from("tenant_modules").select("module_key, is_enabled, pending_removal_since, source").eq("tenant_id", tenantId),
    supabase.from("tenants").select("plan_id").eq("id", tenantId).single(),
    supabase.from("module_requests").select("module_key").eq("tenant_id", tenantId).eq("status", "pending"),
  ]);

  const { data: planModules } = tenant?.plan_id
    ? await supabase.from("plan_modules").select("module_key").eq("plan_id", tenant.plan_id)
    : { data: [] as { module_key: string }[] | null };

  const planModuleKeys = new Set((planModules ?? []).map((p) => p.module_key));
  const pendingRequestKeys = new Set((pendingRequests ?? []).map((r) => r.module_key));

  return MODULE_KEYS.map((moduleKey) => {
    const row = (modules ?? []).find((m) => m.module_key === moduleKey);
    return {
      moduleKey,
      isEnabled: row?.is_enabled ?? false,
      pendingRemovalSince: row?.pending_removal_since ?? null,
      isIncludedInPlan: planModuleKeys.has(moduleKey),
      hasPendingRequest: pendingRequestKeys.has(moduleKey),
      source: (row?.source as "plan" | "paid_addon" | "granted" | undefined) ?? null,
    };
  });
}

export type AdminTheme = { key: string; name: string };

/** Yalnızca is_public=true temalar — platform_admin'e ayrılmış temalar staff'a hiç görünmez. */
export async function getPublicThemes(): Promise<AdminTheme[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("themes").select("key, name").eq("is_public", true).order("name");

  return data ?? [];
}
