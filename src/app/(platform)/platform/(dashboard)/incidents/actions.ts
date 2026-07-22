"use server";

import { revalidatePath } from "next/cache";

import { getCurrentPlatformAdmin } from "@/lib/auth/platformSession";
import { incidentFormSchema, incidentUpdateFormSchema, type PlatformActionResult } from "@/lib/platform/schemas";
import { createClient } from "@/lib/supabase/server";

export async function createIncident(input: unknown): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const parsed = incidentFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.from("incidents").insert({ title: parsed.data.title });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/platform/incidents");
  revalidatePath("/status");
  return { ok: true };
}

export async function addIncidentUpdate(incidentId: string, input: unknown): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const parsed = incidentUpdateFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error: updateInsertError } = await supabase
    .from("incident_updates")
    .insert({ incident_id: incidentId, body: parsed.data.body });
  if (updateInsertError) return { ok: false, error: "unknown" };

  const { error: statusError } = await supabase
    .from("incidents")
    .update({
      status: parsed.data.status,
      resolved_at: parsed.data.status === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", incidentId);
  if (statusError) return { ok: false, error: "unknown" };

  revalidatePath("/platform/incidents");
  revalidatePath("/status");
  return { ok: true };
}
