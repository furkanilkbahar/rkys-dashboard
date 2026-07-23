import "server-only";

import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { MODULE_KEYS, type ModuleKey } from "./keys";

export { MODULE_KEYS };
export type { ModuleKey };

/**
 * Kapalı modül hiçbir yüzeyde görünmez (RULES #34) — satır yoksa (henüz
 * seed edilmemiş) fail-closed: false. Server-only, client'tan çağrılamaz.
 *
 * tenant_modules RLS'i staff-only (0007) — misafir tarafının kendi
 * tenant'ındaki bir modülün durumunu sorabilmesi için doğrudan tablo yerine
 * is_module_enabled RPC'si (0051) kullanılır, is_tenant_active (0037) ile
 * aynı desen.
 */
export async function isEnabled(tenantId: string, moduleKey: ModuleKey): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_module_enabled", { p_tenant_id: tenantId, p_module_key: moduleKey });

  return data ?? false;
}

/** Route/API guard'ı: modül kapalıysa 404 — kapalı modülün varlığı bile sızmaz. */
export async function assertModuleEnabled(tenantId: string, moduleKey: ModuleKey): Promise<void> {
  const enabled = await isEnabled(tenantId, moduleKey);
  if (!enabled) {
    notFound();
  }
}
