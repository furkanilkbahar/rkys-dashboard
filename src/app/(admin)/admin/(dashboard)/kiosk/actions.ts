"use server";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import { getDefaultBranchId } from "@/lib/data/branch";
import { kioskDeviceFormSchema, type KioskActionResult } from "@/lib/kiosk/schemas";
import { generatePairingCode } from "@/lib/kiosk/pairing";
import { isEnabled } from "@/lib/modules/isEnabled";
import { createClient } from "@/lib/supabase/server";

export async function createKioskDevice(input: unknown): Promise<KioskActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (!(await isEnabled(actor.tenantId, "kiosk"))) return { ok: false, error: "not_enabled" };

  const parsed = kioskDeviceFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) return { ok: false, error: "unknown" };

  const supabase = await createClient();
  const { error } = await supabase.from("kiosk_devices").insert({
    tenant_id: actor.tenantId,
    branch_id: branchId,
    device_name: parsed.data.deviceName,
    pairing_code: generatePairingCode(),
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/kiosk");
  return { ok: true };
}

export async function toggleKioskDevice(deviceId: string, isActive: boolean): Promise<KioskActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.from("kiosk_devices").update({ is_active: isActive }).eq("id", deviceId).eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/kiosk");
  return { ok: true };
}
