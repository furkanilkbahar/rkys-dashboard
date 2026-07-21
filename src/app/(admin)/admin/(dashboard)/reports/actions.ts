"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentActor } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ReportsActionResult = { ok: true } | { ok: false; error: "forbidden" | "already_closed" | "invalid_input" | "unknown" };

export async function closeBusinessDay(branchId: string): Promise<ReportsActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_business_day", { p_branch_id: branchId });

  if (error) {
    if (error.message.includes("already closed")) return { ok: false, error: "already_closed" };
    if (error.message.includes("forbidden")) return { ok: false, error: "forbidden" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/admin/reports");
  return { ok: true };
}

const updateProductCostSchema = z.object({
  productId: z.uuid(),
  costMinor: z.number().int().min(0),
});

export async function updateProductCost(input: unknown): Promise<ReportsActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = updateProductCostSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_costs")
    .upsert(
      { tenant_id: actor.tenantId, product_id: parsed.data.productId, cost_minor: parsed.data.costMinor, updated_at: new Date().toISOString() },
      { onConflict: "product_id" },
    );
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/reports");
  return { ok: true };
}
