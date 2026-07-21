"use server";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import { staffOrderSchema, type SubmitStaffOrderResult } from "@/lib/pos/schemas";
import { createClient } from "@/lib/supabase/server";

export async function submitStaffOrder(input: unknown): Promise<SubmitStaffOrderResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = staffOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_staff_order", {
    p_table_id: parsed.data.tableId,
    p_items: parsed.data.items,
  });

  if (error) {
    if (error.message.startsWith("STOCK_UNAVAILABLE")) return { ok: false, error: "stock_unavailable" };
    if (error.message.includes("staff only") || error.message.includes("pos_cash module disabled")) {
      return { ok: false, error: "forbidden" };
    }
    return { ok: false, error: "unknown" };
  }

  const row = data?.[0];
  if (!row) return { ok: false, error: "unknown" };

  revalidatePath("/cashier/order");
  return { ok: true, orderId: row.order_id, status: row.order_status, subtotalMinor: row.subtotal_minor };
}
