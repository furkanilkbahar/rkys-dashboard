"use server";

import { revalidatePath } from "next/cache";

import { getCurrentPlatformAdmin } from "@/lib/auth/platformSession";
import type { PlatformActionResult } from "@/lib/platform/schemas";
import { createClient } from "@/lib/supabase/server";

export async function approveTenant(tenantId: string): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_tenant", { p_tenant_id: tenantId });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/platform/pending-tenants");
  revalidatePath("/platform");
  return { ok: true };
}

export async function rejectTenant(tenantId: string): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_tenant", { p_tenant_id: tenantId });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/platform/pending-tenants");
  revalidatePath("/platform");
  return { ok: true };
}
