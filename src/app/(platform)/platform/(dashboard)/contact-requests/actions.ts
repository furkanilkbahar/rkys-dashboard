"use server";

import { revalidatePath } from "next/cache";

import { getCurrentPlatformAdmin } from "@/lib/auth/platformSession";
import type { PlatformActionResult } from "@/lib/platform/schemas";
import { createClient } from "@/lib/supabase/server";

export async function resolveContactRequest(requestId: string, status: "contacted" | "closed"): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_contact_request", {
    p_request_id: requestId,
    p_status: status,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/platform/contact-requests");
  return { ok: true };
}
