import "server-only";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getCurrentGuestSession } from "@/lib/guest/session";

/**
 * QR ile gelen misafiri masanın aktif table_session'ına bağlar: RPC ile
 * oturumu aç/bul → zaten aynı oturuma bağlıysa (sayfa yenileme) hiçbir şey
 * yapma → değilse yeni bir Anonymous Auth kullanıcısı oluştur ve
 * table_session_devices'a bağla → JWT'nin misafir claim'lerini taşıması
 * için oturumu tazele (custom_access_token_hook'u yeniden tetikler).
 */
export async function bootstrapGuestSessionForTable(tableId: string): Promise<boolean> {
  const service = createServiceRoleClient();

  const { data: tableSessionId, error: sessionError } = await service.rpc(
    "open_or_get_active_table_session",
    { p_table_id: tableId },
  );
  if (sessionError) {
    console.error("open_or_get_active_table_session failed", sessionError);
  }
  if (sessionError || !tableSessionId) {
    return false;
  }

  const existing = await getCurrentGuestSession();
  if (existing && existing.tableSessionId === tableSessionId) {
    return true;
  }

  const { data: table } = await service
    .from("tables")
    .select("tenant_id, branch_id")
    .eq("id", tableId)
    .single();
  if (!table) {
    return false;
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
  if (authError) {
    console.error("guest anonymous sign-in failed", authError);
  }
  if (authError || !authData.user) {
    return false;
  }

  const { error: linkError } = await service.rpc("link_guest_device", {
    p_guest_user_id: authData.user.id,
    p_table_session_id: tableSessionId,
    p_tenant_id: table.tenant_id,
    p_branch_id: table.branch_id,
  });
  if (linkError) {
    console.error("link_guest_device failed", linkError);
    return false;
  }

  await supabase.auth.refreshSession();
  return true;
}

/**
 * Misafirin cookie'sindeki mevcut oturum, verilen kanal/tenant için hâlâ
 * geçerliyse onu döndürür — /paket, /kiosk/[code], /teslimat bootstrap
 * uçlarına doğrudan (sayfa yenileme, geri tuşu, yer imi) her gelişte YENİ
 * bir table_session + YENİ bir anonim auth kullanıcısı açılmasını önler
 * (bootstrapGuestSessionForTable'daki "zaten bağlıysa dokunma" deseninin
 * pickup/kiosk/delivery karşılığı — dine_in'in aksine burada tekil bir
 * table_id anahtarı olmadığı için channel/kiosk_device_id ile eşleşir).
 */
async function findReusableGuestSession(
  service: ReturnType<typeof createServiceRoleClient>,
  tenantId: string,
  channel: "pickup" | "delivery",
  kioskDeviceId: string | null,
): Promise<string | null> {
  const existing = await getCurrentGuestSession();
  if (!existing || existing.tenantId !== tenantId) {
    return null;
  }

  let query = service
    .from("table_sessions")
    .select("id")
    .eq("id", existing.tableSessionId)
    .eq("channel", channel)
    .eq("status", "active");
  query = kioskDeviceId ? query.eq("kiosk_device_id", kioskDeviceId) : query.is("kiosk_device_id", null);

  const { data } = await query.maybeSingle();
  return data?.id ?? null;
}

/**
 * Gel-Al (pickup) bootstrap: fiziksel masası olmadığı için QR/tableId yok —
 * yalnızca tenant context'i (middleware'in enjekte ettiği header, bkz.
 * getCurrentTenant) yeterli. open_pickup_session (0061) her çağrıda YENİ bir
 * oturum açar (dine_in'in "masa başına tek aktif oturum" kısıtı burada
 * anlamsız) — bu yüzden reuse kontrolü burada yapılır. Geri kalanı
 * bootstrapGuestSessionForTable ile birebir aynı.
 */
export async function bootstrapPickupSession(tenantId: string): Promise<string | null> {
  const service = createServiceRoleClient();

  const reusable = await findReusableGuestSession(service, tenantId, "pickup", null);
  if (reusable) {
    return reusable;
  }

  const { data, error: sessionError } = await service.rpc("open_pickup_session", { p_tenant_id: tenantId });
  if (sessionError || !data || data.length === 0) {
    return null;
  }
  const tableSessionId = data[0].table_session_id;

  const { data: session } = await service.from("table_sessions").select("branch_id").eq("id", tableSessionId).single();
  if (!session) {
    return null;
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
  if (authError || !authData.user) {
    return null;
  }

  const { error: linkError } = await service.rpc("link_guest_device", {
    p_guest_user_id: authData.user.id,
    p_table_session_id: tableSessionId,
    p_tenant_id: tenantId,
    p_branch_id: session.branch_id,
  });
  if (linkError) {
    return null;
  }

  await supabase.auth.refreshSession();
  return tableSessionId;
}

/**
 * Kiosk modu bootstrap: open_pickup_session (yukarı) ile birebir aynı yapı,
 * yalnızca open_kiosk_session (0069) çağrılır — pairing_code'un geçerli/aktif
 * bir kiosk_devices satırına ait olduğunu ve 'kiosk' modülünün açık olduğunu
 * RPC içinde doğrular. "Kod yeniden kullanımı" ilkesi (PRD Faz 11): sonuç
 * oturum channel='pickup' olarak açılır, misafir tarafı AYNI /paket sayfasını
 * kullanır — yalnızca kiosk_device_id ile hangi tabletten geldiği izlenir.
 */
export async function bootstrapKioskSession(tenantId: string, pairingCode: string): Promise<string | null> {
  const service = createServiceRoleClient();

  const { data: device } = await service
    .from("kiosk_devices")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("pairing_code", pairingCode)
    .eq("is_active", true)
    .maybeSingle();

  if (device) {
    const reusable = await findReusableGuestSession(service, tenantId, "pickup", device.id);
    if (reusable) {
      return reusable;
    }
  }

  const { data, error: sessionError } = await service.rpc("open_kiosk_session", { p_tenant_id: tenantId, p_pairing_code: pairingCode });
  if (sessionError || !data || data.length === 0) {
    return null;
  }
  const tableSessionId = data[0].table_session_id;

  const { data: session } = await service.from("table_sessions").select("branch_id").eq("id", tableSessionId).single();
  if (!session) {
    return null;
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
  if (authError || !authData.user) {
    return null;
  }

  const { error: linkError } = await service.rpc("link_guest_device", {
    p_guest_user_id: authData.user.id,
    p_table_session_id: tableSessionId,
    p_tenant_id: tenantId,
    p_branch_id: session.branch_id,
  });
  if (linkError) {
    return null;
  }

  await supabase.auth.refreshSession();
  return tableSessionId;
}

/**
 * Paket servis (delivery) bootstrap — bootstrapPickupSession ile birebir
 * aynı, yalnızca open_delivery_session (0062) çağrılır. Bölge/adres/
 * zamanlanmış teslimat bilgisi burada değil, checkout'ta (submit_order)
 * toplanır (Varsayım, bkz. 0062 migration yorumu).
 */
export async function bootstrapDeliverySession(tenantId: string): Promise<string | null> {
  const service = createServiceRoleClient();

  const reusable = await findReusableGuestSession(service, tenantId, "delivery", null);
  if (reusable) {
    return reusable;
  }

  const { data: tableSessionId, error: sessionError } = await service.rpc("open_delivery_session", { p_tenant_id: tenantId });
  if (sessionError || !tableSessionId) {
    return null;
  }

  const { data: session } = await service.from("table_sessions").select("branch_id").eq("id", tableSessionId).single();
  if (!session) {
    return null;
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
  if (authError || !authData.user) {
    return null;
  }

  const { error: linkError } = await service.rpc("link_guest_device", {
    p_guest_user_id: authData.user.id,
    p_table_session_id: tableSessionId,
    p_tenant_id: tenantId,
    p_branch_id: session.branch_id,
  });
  if (linkError) {
    return null;
  }

  await supabase.auth.refreshSession();
  return tableSessionId;
}
