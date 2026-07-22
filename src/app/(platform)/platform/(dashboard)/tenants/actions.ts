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
