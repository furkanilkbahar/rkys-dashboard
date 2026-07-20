import "server-only";

import { notFound } from "next/navigation";

import type { CurrentActor } from "./session";

/**
 * Yüzey bazlı rol kısıtlaması (garson paneli/KDS gibi) — kapalı modül
 * deseniyle aynı fail-closed mantık: izinsiz rol için 404 (RULES #34'ün rol
 * eşdeğeri, varlığı bile sızmaz). Girişsiz ziyaretçi yönlendirmesi (login'e)
 * çağıran sayfanın kendi sorumluluğudur — bu guard yalnızca rol üyeliğine bakar.
 */
export function assertStaffRole(actor: CurrentActor, allowedRoles: readonly CurrentActor["role"][]): void {
  if (!allowedRoles.includes(actor.role)) {
    notFound();
  }
}
