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
    return false;
  }

  await supabase.auth.refreshSession();
  return true;
}

/**
 * Gel-Al (pickup) bootstrap: fiziksel masası olmadığı için QR/tableId yok —
 * yalnızca tenant context'i (middleware'in enjekte ettiği header, bkz.
 * getCurrentTenant) yeterli. open_pickup_session (0061) her çağrıda YENİ bir
 * oturum açar (dine_in'in "masa başına tek aktif oturum" kısıtı burada
 * anlamsız). Geri kalanı bootstrapGuestSessionForTable ile birebir aynı.
 */
export async function bootstrapPickupSession(tenantId: string): Promise<string | null> {
  const service = createServiceRoleClient();

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
