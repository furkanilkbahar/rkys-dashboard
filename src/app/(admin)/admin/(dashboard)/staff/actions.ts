"use server";

import { revalidatePath } from "next/cache";

import { assertCan, PERMISSION_KEYS, type PermissionKey } from "@/lib/auth/can";
import { getCurrentActor } from "@/lib/auth/session";
import { STAFF_MANAGEABLE_ROLES, type StaffRole } from "@/lib/data/adminStaff";
import {
  deviceFormSchema,
  pinResetFormSchema,
  staffUpdateFormSchema,
  type DeviceActionResult,
  type StaffActionResult,
} from "@/lib/staff/schemas";
import { createClient } from "@/lib/supabase/server";

function mapRpcError(message: string | undefined): Extract<StaffActionResult, { ok: false }>["error"] {
  if (!message) return "unknown";
  if (message.includes("last owner")) return "last_owner";
  if (message.includes("permission denied") || message.includes("only an owner")) return "forbidden";
  if (message.includes("not found")) return "not_found";
  return "unknown";
}

export async function updateStaffMember(profileId: string, input: unknown): Promise<StaffActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = staffUpdateFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_staff_member", {
    p_profile_id: profileId,
    p_role: parsed.data.role,
    p_badge_no: parsed.data.badgeNo,
    p_is_active: parsed.data.isActive,
  });
  if (error) return { ok: false, error: mapRpcError(error.message) };

  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function resetStaffPin(profileId: string, input: unknown): Promise<StaffActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = pinResetFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_staff_pin", { p_profile_id: profileId, p_new_pin: parsed.data.pin });
  if (error) return { ok: false, error: mapRpcError(error.message) };

  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function createStaffDevice(branchId: string, input: unknown): Promise<DeviceActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = deviceFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_staff_device", {
    p_branch_id: branchId,
    p_label: parsed.data.label,
  });
  if (error || !data) return { ok: false, error: "unknown" };

  revalidatePath("/admin/staff");
  return { ok: true, rawSecret: data };
}

export async function revokeStaffDevice(deviceId: string): Promise<StaffActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_staff_device", { p_device_id: deviceId });
  if (error) return { ok: false, error: mapRpcError(error.message) };

  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function updateRolePermission(
  role: StaffRole,
  permissionKey: PermissionKey,
  allowed: boolean,
): Promise<StaffActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  try {
    await assertCan(actor, "staff.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (!STAFF_MANAGEABLE_ROLES.includes(role) || !PERMISSION_KEYS.includes(permissionKey)) {
    return { ok: false, error: "invalid_input" };
  }
  if (role === "owner") {
    // owner can() içinde her zaman true kabul edilir, satır anlamsız.
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("role_permissions")
    .upsert(
      { tenant_id: actor.tenantId, role, permission_key: permissionKey, allowed },
      { onConflict: "tenant_id,role,permission_key" },
    );
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/staff");
  return { ok: true };
}
