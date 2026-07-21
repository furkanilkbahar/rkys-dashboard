"use server";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import {
  cashMovementServerSchema,
  closeShiftServerSchema,
  openShiftServerSchema,
  type CashierActionResult,
  type OpenShiftResult,
} from "@/lib/cashier/schemas";
import { createClient } from "@/lib/supabase/server";

export async function openShift(branchId: string, input: unknown): Promise<OpenShiftResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = openShiftServerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_shift", {
    p_branch_id: branchId,
    p_opening_balance_minor: parsed.data.openingBalance,
  });

  if (error) {
    if (error.message.includes("already open")) return { ok: false, error: "already_open" };
    return { ok: false, error: "forbidden" };
  }

  revalidatePath("/cashier");
  return { ok: true, shiftId: data as string };
}

export async function closeShift(shiftId: string, input: unknown): Promise<CashierActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = closeShiftServerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_shift", {
    p_shift_id: shiftId,
    p_counted_cash_minor: parsed.data.countedCash,
  });

  if (error) {
    if (error.message.includes("not open")) return { ok: false, error: "not_open" };
    return { ok: false, error: "forbidden" };
  }

  revalidatePath("/cashier");
  return { ok: true };
}

export async function recordCashMovement(shiftId: string, input: unknown): Promise<CashierActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = cashMovementServerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_cash_movement", {
    p_shift_id: shiftId,
    p_movement_type: parsed.data.movementType,
    p_amount_minor: parsed.data.amount,
    p_note: parsed.data.note || undefined,
  });

  if (error) {
    if (error.message.includes("not open")) return { ok: false, error: "not_open" };
    return { ok: false, error: "forbidden" };
  }

  revalidatePath("/cashier");
  return { ok: true };
}
