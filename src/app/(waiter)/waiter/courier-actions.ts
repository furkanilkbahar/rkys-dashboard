"use server";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type CourierActionResult = { ok: true } | { ok: false; error: "forbidden" | "invalid_input" | "unknown" };

export async function assignCourier(orderId: string, courierId: string): Promise<CourierActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_courier", { p_order_id: orderId, p_courier_id: courierId });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/waiter");
  revalidatePath("/courier");
  return { ok: true };
}

export async function advanceCourierAssignment(assignmentId: string, toStatus: "en_route" | "delivered"): Promise<CourierActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("advance_courier_assignment", { p_assignment_id: assignmentId, p_to_status: toStatus });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/waiter");
  revalidatePath("/courier");
  return { ok: true };
}
