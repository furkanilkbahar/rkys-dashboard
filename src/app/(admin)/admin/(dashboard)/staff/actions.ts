"use server";

import { revalidatePath } from "next/cache";

import { assertCan, PERMISSION_KEYS, type PermissionKey } from "@/lib/auth/can";
import { getCurrentActor } from "@/lib/auth/session";
import { STAFF_MANAGEABLE_ROLES, type StaffRole } from "@/lib/data/adminStaff";
import {
  createStaffMemberFormSchema,
  deviceFormSchema,
  pinResetFormSchema,
  staffUpdateFormSchema,
  type DeviceActionResult,
  type StaffActionResult,
} from "@/lib/staff/schemas";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

function mapRpcError(message: string | undefined): Extract<StaffActionResult, { ok: false }>["error"] {
  if (!message) return "unknown";
  if (message.includes("last owner")) return "last_owner";
  if (message.includes("permission denied") || message.includes("only an owner")) return "forbidden";
  if (message.includes("not found")) return "not_found";
  return "unknown";
}

/**
 * D87: yeni personel oluşturur. auth.users satırı sentetik bir e-postayla
 * (hiçbir yüzeyde gösterilmez, personel hiçbir zaman görmez/kullanmaz)
 * service-role ile açılır — kimlik doğrulaması tamamen PIN üzerinden
 * yürür (bkz. verify_staff_pin_identity, 0089). PIN, actor'ın KENDİ
 * oturumuyla mevcut/test edilmiş reset_staff_pin RPC'si üzerinden set
 * edilir (yeni bcrypt bağımlılığı gerekmez).
 */
export async function createStaffMember(input: unknown): Promise<StaffActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  try {
    await assertCan(actor, "staff.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = createStaffMemberFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  if (parsed.data.role === "owner" && actor.role !== "owner") {
    return { ok: false, error: "forbidden" };
  }

  const service = createServiceRoleClient();
  const syntheticEmail = `staff-${crypto.randomUUID()}@internal.rkys.local`;
  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email: syntheticEmail,
    password: crypto.randomUUID(),
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    return { ok: false, error: "unknown" };
  }

  const { error: profileError } = await service.from("profiles").insert({
    id: authUser.user.id,
    tenant_id: actor.tenantId,
    role: parsed.data.role,
    badge_no: parsed.data.badgeNo || null,
    is_active: true,
  });
  if (profileError) {
    await service.auth.admin.deleteUser(authUser.user.id);
    return { ok: false, error: "unknown" };
  }

  const supabase = await createClient();
  const { error: pinError } = await supabase.rpc("reset_staff_pin", {
    p_profile_id: authUser.user.id,
    p_new_pin: parsed.data.pin,
  });
  if (pinError) {
    await service.auth.admin.deleteUser(authUser.user.id);
    return { ok: false, error: "invalid_input" };
  }

  revalidatePath("/admin/staff");
  return { ok: true };
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
