"use server";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import { getDefaultBranchId } from "@/lib/data/branch";
import { isEnabled } from "@/lib/modules/isEnabled";
import { shiftFormSchema, type SchedulingActionResult } from "@/lib/scheduling/schemas";
import { createClient } from "@/lib/supabase/server";

export async function createShift(input: unknown): Promise<SchedulingActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (!(await isEnabled(actor.tenantId, "staff_scheduling"))) return { ok: false, error: "not_enabled" };

  const parsed = shiftFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) return { ok: false, error: "unknown" };

  const supabase = await createClient();
  const { error } = await supabase.from("staff_shifts").insert({
    tenant_id: actor.tenantId,
    branch_id: branchId,
    profile_id: parsed.data.profileId,
    shift_date: parsed.data.shiftDate,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/scheduling");
  return { ok: true };
}

export async function deleteShift(shiftId: string): Promise<SchedulingActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.from("staff_shifts").delete().eq("id", shiftId).eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/scheduling");
  return { ok: true };
}
