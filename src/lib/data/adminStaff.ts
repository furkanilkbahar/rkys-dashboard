import "server-only";

import { PERMISSION_KEYS, type PermissionKey } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { STAFF_MANAGEABLE_ROLES, type StaffRole } from "@/lib/staff/roles";

export { STAFF_MANAGEABLE_ROLES, type StaffRole };

export type AdminStaffMember = {
  id: string;
  role: StaffRole;
  /**
   * Faz 23 (0091). NULL olabilir: D87 ile açılmış mevcut personelin adı yok
   * ve migration onları geçersiz kılmıyor. UI ada düşemezse rozete, o da
   * yoksa role düşer — eksik veri sahte bir değerle doldurulmaz.
   */
  fullName: string | null;
  badgeNo: string | null;
  photoUrl: string | null;
  isActive: boolean;
  hasPin: boolean;
};

export type AdminStaffDevice = {
  id: string;
  label: string;
  isActive: boolean;
  lastSeenAt: string | null;
};

export async function getAdminStaff(tenantId: string): Promise<AdminStaffMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, badge_no, photo_url, is_active, pin_hash")
    .eq("tenant_id", tenantId)
    // Ada göre sırala; adı olmayanlar sona (nullsFirst: false).
    .order("full_name", { nullsFirst: false })
    .order("role");

  return (data ?? []).map((p) => ({
    id: p.id,
    role: p.role as StaffRole,
    fullName: p.full_name,
    badgeNo: p.badge_no,
    photoUrl: p.photo_url,
    isActive: p.is_active,
    hasPin: p.pin_hash !== null,
  }));
}

export async function getStaffDevices(tenantId: string, branchId: string): Promise<AdminStaffDevice[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_devices")
    .select("id, device_label, is_active, last_seen_at")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .order("created_at");

  return (data ?? []).map((d) => ({
    id: d.id,
    label: d.device_label,
    isActive: d.is_active,
    lastSeenAt: d.last_seen_at,
  }));
}

export type RolePermissionMatrix = Record<StaffRole, Record<PermissionKey, boolean>>;

export async function getRolePermissionMatrix(tenantId: string): Promise<RolePermissionMatrix> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("role_permissions")
    .select("role, permission_key, allowed")
    .eq("tenant_id", tenantId);

  const matrix = Object.fromEntries(
    STAFF_MANAGEABLE_ROLES.map((role) => [
      role,
      Object.fromEntries(PERMISSION_KEYS.map((key) => [key, role === "owner"])) as Record<PermissionKey, boolean>,
    ]),
  ) as RolePermissionMatrix;

  for (const row of data ?? []) {
    if (STAFF_MANAGEABLE_ROLES.includes(row.role as StaffRole)) {
      matrix[row.role as StaffRole][row.permission_key as PermissionKey] = row.allowed;
    }
  }

  return matrix;
}
