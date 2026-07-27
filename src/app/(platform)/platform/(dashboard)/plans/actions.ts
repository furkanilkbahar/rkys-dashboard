"use server";

import { revalidatePath } from "next/cache";

import { getCurrentPlatformAdmin } from "@/lib/auth/platformSession";
import { planFormSchema, planUpdateFormSchema, type PlatformActionResult } from "@/lib/platform/schemas";
import { createClient } from "@/lib/supabase/server";

export async function createPlan(input: unknown): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const parsed = planFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_plan", {
    p_key: parsed.data.key,
    p_name: parsed.data.name,
    p_price_minor: parsed.data.priceMinor,
    p_table_limit: (parsed.data.tableLimit === "" ? null : parsed.data.tableLimit) as number,
    p_included_branch_count: parsed.data.includedBranchCount,
    p_extra_branch_price_minor: parsed.data.extraBranchPriceMinor,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/platform/plans");
  return { ok: true };
}

export async function updatePlan(planId: string, input: unknown): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const parsed = planUpdateFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_plan", {
    p_plan_id: planId,
    p_name: parsed.data.name,
    p_price_minor: parsed.data.priceMinor,
    p_table_limit: (parsed.data.tableLimit === "" ? null : parsed.data.tableLimit) as number,
    p_included_branch_count: parsed.data.includedBranchCount,
    p_extra_branch_price_minor: parsed.data.extraBranchPriceMinor,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/platform/plans");
  return { ok: true };
}

export async function setPlanModule(planId: string, moduleKey: string, included: boolean): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_plan_module", {
    p_plan_id: planId,
    p_module_key: moduleKey,
    p_included: included,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/platform/plans");
  return { ok: true };
}
