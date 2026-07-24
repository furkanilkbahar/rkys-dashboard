import "server-only";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export type AdminKioskDevice = {
  id: string;
  deviceName: string;
  pairingCode: string;
  isActive: boolean;
  lastActiveAt: string | null;
};

export type KioskOrigin = { isKiosk: boolean; pairingCode: string | null };

// /paket sayfası kiosk'tan mı yoksa misafirin kendi telefonundan mı geldiğini
// ayırt eder — yalnızca kiosk kökenli oturumlarda "sıradaki müşteri" sıfırlama
// butonu gösterilir (paylaşılan fiziksel cihaz, telefonun aksine).
// Service-role gerekir: kiosk_devices RLS'i yalnızca is_staff()'e izin verir,
// misafir kendi table_sessions satırını okuyabilir ama iç içe kiosk_devices
// join'i RLS tarafından ayrıca süzülür ve misafir için hep null döner.
export async function getKioskOrigin(tableSessionId: string): Promise<KioskOrigin> {
  const supabase = await createClient();
  const { data: session } = await supabase.from("table_sessions").select("kiosk_device_id").eq("id", tableSessionId).maybeSingle();
  if (!session?.kiosk_device_id) {
    return { isKiosk: false, pairingCode: null };
  }

  const service = createServiceRoleClient();
  const { data: device } = await service.from("kiosk_devices").select("pairing_code").eq("id", session.kiosk_device_id).maybeSingle();
  return { isKiosk: true, pairingCode: device?.pairing_code ?? null };
}

export async function getAdminKioskDevices(tenantId: string, branchId: string): Promise<AdminKioskDevice[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kiosk_devices")
    .select("id, device_name, pairing_code, is_active, last_active_at")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .order("created_at");

  return (data ?? []).map((d) => ({
    id: d.id,
    deviceName: d.device_name,
    pairingCode: d.pairing_code,
    isActive: d.is_active,
    lastActiveAt: d.last_active_at,
  }));
}
