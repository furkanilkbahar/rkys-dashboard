"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentActor } from "@/lib/auth/session";
import { deliveryZoneFormSchema, feeMinor, minBasketMinor, type DeliveryZoneActionResult } from "@/lib/delivery/schemas";
import { isEnabled } from "@/lib/modules/isEnabled";
import { createClient } from "@/lib/supabase/server";
import { getDefaultBranchId } from "@/lib/data/branch";

export async function createDeliveryZone(input: unknown): Promise<DeliveryZoneActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (!(await isEnabled(actor.tenantId, "delivery"))) return { ok: false, error: "not_enabled" };

  const parsed = deliveryZoneFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) return { ok: false, error: "unknown" };

  const supabase = await createClient();
  const { error } = await supabase.from("delivery_zones").insert({
    tenant_id: actor.tenantId,
    branch_id: branchId,
    name: parsed.data.name,
    fee_minor: feeMinor(parsed.data),
    min_basket_minor: minBasketMinor(parsed.data),
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/delivery-zones");
  return { ok: true };
}

export async function toggleDeliveryZone(zoneId: string, isActive: boolean): Promise<DeliveryZoneActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (!(await isEnabled(actor.tenantId, "delivery"))) return { ok: false, error: "not_enabled" };
  if (!z.uuid().safeParse(zoneId).success) return { ok: false, error: "unknown" };

  const supabase = await createClient();
  const { error } = await supabase.from("delivery_zones").update({ is_active: isActive }).eq("id", zoneId).eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/delivery-zones");
  return { ok: true };
}
