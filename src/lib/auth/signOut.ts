"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * scope: "local" olmadan Supabase varsayılanı GLOBAL çıkış yapar — bu
 * kullanıcının aynı hesapla açık diğer cihaz/oturumlarını da geçersiz kılar.
 * Yalnızca bu cihazdaki oturum kapatılmalı, diğerleri etkilenmemeli.
 */
export async function signOutCurrentDevice(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut({ scope: "local" });
  window.location.assign("/admin/login");
}
