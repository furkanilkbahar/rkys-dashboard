"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Kiosk tabletinde "Sıradaki Müşteri" butonu: mevcut anonim misafir
 * oturumunu kapatır — /kiosk/[pairingCode]/baslat'a dönüldüğünde yeni bir
 * signInAnonymously + open_kiosk_session ile temiz bir oturum açılır.
 */
export async function endKioskSession(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
