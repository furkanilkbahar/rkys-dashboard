import "server-only";

import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const MODULE_KEYS = [
  "pos_cash",
  "inventory",
  "recipes",
  "crm_loyalty",
  "campaigns",
  "gift_cards",
  "pickup",
  "delivery",
  "courier",
  "marketplace",
  "reservations",
  "kiosk",
  "staff_scheduling",
  "accounting_export",
  "api_access",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/**
 * Kapalı modül hiçbir yüzeyde görünmez (RULES #34) — satır yoksa (henüz
 * seed edilmemiş) fail-closed: false. Server-only, client'tan çağrılamaz.
 */
export async function isEnabled(tenantId: string, moduleKey: ModuleKey): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_modules")
    .select("is_enabled")
    .eq("tenant_id", tenantId)
    .eq("module_key", moduleKey)
    .maybeSingle();

  return data?.is_enabled ?? false;
}

/** Route/API guard'ı: modül kapalıysa 404 — kapalı modülün varlığı bile sızmaz. */
export async function assertModuleEnabled(tenantId: string, moduleKey: ModuleKey): Promise<void> {
  const enabled = await isEnabled(tenantId, moduleKey);
  if (!enabled) {
    notFound();
  }
}
