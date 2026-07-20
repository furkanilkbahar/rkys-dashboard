import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { CurrentActor } from "./session";

export const PERMISSION_KEYS = [
  "comp_discount",
  "refund",
  "reports.revenue",
  "reports.profit",
  "menu.edit",
  "cash.open_close",
  "session.move",
  "reservations.manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export class PermissionDeniedError extends Error {
  constructor(permissionKey: PermissionKey) {
    super(`Permission denied: ${permissionKey}`);
    this.name = "PermissionDeniedError";
  }
}

/**
 * İzin bayrağı kontrolü (RULES #41) — satır yoksa fail-closed: false.
 * owner her zaman izinlidir (tenant'ın sahibi, role_permissions'a bağımlı değil).
 */
export async function can(actor: CurrentActor, permissionKey: PermissionKey): Promise<boolean> {
  if (actor.role === "owner") {
    return true;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("role_permissions")
    .select("allowed")
    .eq("tenant_id", actor.tenantId)
    .eq("role", actor.role)
    .eq("permission_key", permissionKey)
    .maybeSingle();

  return data?.allowed ?? false;
}

export async function assertCan(actor: CurrentActor, permissionKey: PermissionKey): Promise<void> {
  if (!(await can(actor, permissionKey))) {
    throw new PermissionDeniedError(permissionKey);
  }
}
