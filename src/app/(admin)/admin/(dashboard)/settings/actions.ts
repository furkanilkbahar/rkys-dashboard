"use server";

import { randomUUID } from "crypto";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import { runOneReportSchedule } from "@/lib/reports/scheduledDigest";
import {
  branchFormSchema,
  businessSettingsFormSchema,
  callTypeFormSchema,
  localeToggleSchema,
  moduleToggleSchema,
  orderSettingsFormSchema,
  ratingSettingsFormSchema,
  reasonCodeFormSchema,
  reportScheduleFormSchema,
  tipPresetFormSchema,
  type BranchActionResult,
  type SettingsActionResult,
} from "@/lib/settings/schemas";
import { createClient } from "@/lib/supabase/server";

async function requireStaffActor() {
  return getCurrentActor();
}

export async function updateOrderSettings(input: unknown): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = orderSettingsFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenant_settings")
    .update({ order_mode: parsed.data.orderMode, session_timeout_minutes: parsed.data.sessionTimeoutMinutes })
    .eq("tenant_id", actor.tenantId);

  if (error) return { ok: false, error: "unknown" };
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function updateBusinessSettings(input: unknown): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (actor.role !== "owner") return { ok: false, error: "forbidden" };

  const parsed = businessSettingsFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_tenant_business_settings", {
    p_currency: parsed.data.currency,
    p_timezone: parsed.data.timezone,
  });

  if (error) return { ok: false, error: "forbidden" };
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function createCallType(input: unknown): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = callTypeFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("call_types")
    .insert({ tenant_id: actor.tenantId, key: randomUUID(), is_active: parsed.data.isActive })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "unknown" };

  await supabase.from("content_translations").upsert(
    [
      { tenant_id: actor.tenantId, entity_type: "call_type", entity_id: data.id, locale: "tr", field: "name", value: parsed.data.nameTr },
      { tenant_id: actor.tenantId, entity_type: "call_type", entity_id: data.id, locale: "en", field: "name", value: parsed.data.nameEn },
    ],
    { onConflict: "entity_type,entity_id,locale,field" },
  );

  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function updateCallType(callTypeId: string, input: unknown): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = callTypeFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("call_types")
    .update({ is_active: parsed.data.isActive })
    .eq("id", callTypeId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  await supabase.from("content_translations").upsert(
    [
      { tenant_id: actor.tenantId, entity_type: "call_type", entity_id: callTypeId, locale: "tr", field: "name", value: parsed.data.nameTr },
      { tenant_id: actor.tenantId, entity_type: "call_type", entity_id: callTypeId, locale: "en", field: "name", value: parsed.data.nameEn },
    ],
    { onConflict: "entity_type,entity_id,locale,field" },
  );

  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function createReasonCode(input: unknown): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = reasonCodeFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reason_codes")
    .insert({
      tenant_id: actor.tenantId,
      category: parsed.data.category,
      key: randomUUID(),
      is_active: parsed.data.isActive,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "unknown" };

  await supabase.from("content_translations").upsert(
    [
      { tenant_id: actor.tenantId, entity_type: "reason_code", entity_id: data.id, locale: "tr", field: "name", value: parsed.data.nameTr },
      { tenant_id: actor.tenantId, entity_type: "reason_code", entity_id: data.id, locale: "en", field: "name", value: parsed.data.nameEn },
    ],
    { onConflict: "entity_type,entity_id,locale,field" },
  );

  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function updateReasonCode(reasonCodeId: string, input: unknown): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = reasonCodeFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("reason_codes")
    .update({ is_active: parsed.data.isActive })
    .eq("id", reasonCodeId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  await supabase.from("content_translations").upsert(
    [
      { tenant_id: actor.tenantId, entity_type: "reason_code", entity_id: reasonCodeId, locale: "tr", field: "name", value: parsed.data.nameTr },
      { tenant_id: actor.tenantId, entity_type: "reason_code", entity_id: reasonCodeId, locale: "en", field: "name", value: parsed.data.nameEn },
    ],
    { onConflict: "entity_type,entity_id,locale,field" },
  );

  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function toggleLocale(input: unknown): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = localeToggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();

  if (!parsed.data.isEnabled) {
    const { error } = await supabase.rpc("disable_tenant_locale", { p_locale: parsed.data.locale });
    if (error) return { ok: false, error: "last_locale" };
  } else {
    const { error } = await supabase
      .from("tenant_locales")
      .insert({ tenant_id: actor.tenantId, locale: parsed.data.locale, is_default: false });
    if (error) return { ok: false, error: "unknown" };
  }

  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function setDefaultLocale(locale: string): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  await supabase
    .from("tenant_locales")
    .update({ is_default: false })
    .eq("tenant_id", actor.tenantId);

  const { error } = await supabase
    .from("tenant_locales")
    .update({ is_default: true })
    .eq("tenant_id", actor.tenantId)
    .eq("locale", locale);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function createTipPreset(input: unknown): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = tipPresetFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.from("tip_presets").insert({
    tenant_id: actor.tenantId,
    label: parsed.data.label,
    percentage: parsed.data.percentage,
    is_active: parsed.data.isActive,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function updateTipPreset(tipPresetId: string, input: unknown): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = tipPresetFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tip_presets")
    .update({ label: parsed.data.label, percentage: parsed.data.percentage, is_active: parsed.data.isActive })
    .eq("id", tipPresetId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function updateRatingSettings(input: unknown): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = ratingSettingsFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("rating_settings")
    .update({
      is_enabled: parsed.data.isEnabled,
      google_review_url: parsed.data.googleReviewUrl === "" ? null : parsed.data.googleReviewUrl,
    })
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function createBranch(input: unknown): Promise<BranchActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = branchFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_branch", { p_name: parsed.data.name }).single();
  if (error) {
    if (error.message.includes("owner only")) return { ok: false, error: "forbidden" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/admin/settings");
  return { ok: true, extraFeeApplies: data.extra_fee_applies };
}

export async function toggleModule(input: unknown): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = moduleToggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenant_modules")
    .upsert(
      { tenant_id: actor.tenantId, module_key: parsed.data.moduleKey, is_enabled: parsed.data.isEnabled },
      { onConflict: "tenant_id,module_key" },
    );
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/settings");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

// D34: gerçek silme geri dönüşü olmayan bir işlem olduğundan owner yalnızca
// bir TALEP oluşturur (request_account_deletion, 0042) — fiili silme Süper
// Admin tarafından manuel yürütülür.
export async function requestAccountDeletion(): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_account_deletion");
  if (error) return { ok: false, error: "forbidden" };

  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function createReportSchedule(input: unknown): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = reportScheduleFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.from("report_schedules").insert({
    tenant_id: actor.tenantId,
    branch_id: parsed.data.branchId,
    frequency: parsed.data.frequency,
    recipient_email: parsed.data.recipientEmail,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function toggleReportSchedule(scheduleId: string, isActive: boolean): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("report_schedules")
    .update({ is_active: isActive })
    .eq("id", scheduleId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function deleteReportSchedule(scheduleId: string): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.from("report_schedules").delete().eq("id", scheduleId).eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/settings");
  return { ok: true };
}

// "Şimdi Gönder" (test): gerçek cron zamanlamasını beklemeden, tek bir
// program için anlık dijest üretip gönderir — pg_net/internal route'a hiç
// uğramaz, aynı runOneReportSchedule fonksiyonunu doğrudan çağırır (S24 E2E
// bu butonla doğrulanabilir olsun diye).
export async function sendReportNow(scheduleId: string): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { data: schedule } = await supabase
    .from("report_schedules")
    .select("id")
    .eq("id", scheduleId)
    .eq("tenant_id", actor.tenantId)
    .single();
  if (!schedule) return { ok: false, error: "not_found" };

  const result = await runOneReportSchedule(scheduleId);
  if (!result.ok) return { ok: false, error: "unknown" };

  revalidatePath("/admin/settings");
  return { ok: true };
}
