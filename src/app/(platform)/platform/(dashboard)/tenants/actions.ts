"use server";

import { revalidatePath } from "next/cache";

import { getCurrentPlatformAdmin } from "@/lib/auth/platformSession";
import type { PlatformActionResult } from "@/lib/platform/schemas";
import { createClient } from "@/lib/supabase/server";

export async function suspendTenant(tenantId: string): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("suspend_tenant", { p_tenant_id: tenantId });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath(`/platform/tenants/${tenantId}`);
  revalidatePath("/platform");
  return { ok: true };
}

export async function reactivateTenant(tenantId: string): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reactivate_tenant", { p_tenant_id: tenantId });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath(`/platform/tenants/${tenantId}`);
  revalidatePath("/platform");
  return { ok: true };
}

/**
 * D101: havale/EFT ile tahsil edilen ödemenin elle işaretlenmesi. Trial'ı
 * dolduğu için proxy'nin abonelik kapısına takılan tenant'ı, sağlayıcı
 * checkout'undan geçmeden pasiflikten çıkarmanın yolu.
 */
export async function markSubscriptionPaid(tenantId: string): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_subscription_paid", {
    p_tenant_id: tenantId,
    p_period_days: 30,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath(`/platform/tenants/${tenantId}`);
  revalidatePath("/platform");
  return { ok: true };
}

export async function assignTenantPlan(tenantId: string, planId: string | null): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  // p_plan_id uuid parametresi SQL'de nullable (plansız bırakma destekleniyor)
  // ama supabase gen types RPC argümanlarını nullable olarak modellemiyor.
  const { error } = await supabase.rpc("assign_tenant_plan", {
    p_tenant_id: tenantId,
    p_plan_id: planId,
  } as { p_tenant_id: string; p_plan_id: string });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath(`/platform/tenants/${tenantId}`);
  return { ok: true };
}

export async function setTenantModule(
  tenantId: string,
  moduleKey: string,
  isEnabled: boolean,
  source: "plan" | "paid_addon" | "granted",
): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tenant_module", {
    p_tenant_id: tenantId,
    p_module_key: moduleKey,
    p_is_enabled: isEnabled,
    p_source: source,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath(`/platform/tenants/${tenantId}`);
  return { ok: true };
}

export async function resolvePendingModuleRemoval(
  tenantId: string,
  moduleKey: string,
  keep: boolean,
): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_pending_module_removal", {
    p_tenant_id: tenantId,
    p_module_key: moduleKey,
    p_keep: keep,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath(`/platform/tenants/${tenantId}`);
  return { ok: true };
}
