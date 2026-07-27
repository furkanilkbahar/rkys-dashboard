"use server";

import { revalidatePath } from "next/cache";

import { getCurrentPlatformAdmin } from "@/lib/auth/platformSession";
import type { PlatformActionResult } from "@/lib/platform/schemas";
import { createClient } from "@/lib/supabase/server";

export async function setEnforce2fa(enabled: boolean): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({ enforce_2fa: enabled, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/platform/settings");
  return { ok: true };
}

export async function setAutoApproveRegistrations(enabled: boolean): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({ auto_approve_registrations: enabled, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/platform/settings");
  return { ok: true };
}
