"use server";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import { isEnabled } from "@/lib/modules/isEnabled";
import { supplierFormSchema, type InventoryActionResult } from "@/lib/inventory/schemas";
import { createClient } from "@/lib/supabase/server";

export async function createSupplier(input: unknown): Promise<InventoryActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (!(await isEnabled(actor.tenantId, "inventory"))) return { ok: false, error: "not_enabled" };

  const parsed = supplierFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").insert({
    tenant_id: actor.tenantId,
    name: parsed.data.name,
    contact_info: parsed.data.contactInfo || null,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/suppliers");
  return { ok: true };
}
