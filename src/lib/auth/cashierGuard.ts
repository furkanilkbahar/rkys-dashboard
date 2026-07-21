import "server-only";

import { redirect } from "next/navigation";

import { assertModuleEnabled } from "@/lib/modules/isEnabled";

import { getCurrentActor, type CurrentActor } from "./session";

/**
 * Kasa (POS) yüzeyi için ortak giriş kontrolü — admin panelle aynı
 * getCurrentActor() (e-posta+şifre) deseni; PIN ile cihaz girişi bu fazın
 * kapsamında değil (doğal yeri Faz 11 Kiosk/vardiya planlama).
 */
export async function requireCashierActor(): Promise<CurrentActor> {
  const actor = await getCurrentActor();

  if (!actor) {
    redirect("/admin/login");
  }

  // RULES #34: kapalı modül route/API/navigasyonda erişilemez olmalı.
  await assertModuleEnabled(actor.tenantId, "pos_cash");

  return actor;
}
