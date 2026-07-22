"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * scope: "local" olmadan Supabase varsayılanı GLOBAL çıkış yapar — bu
 * kullanıcının aynı hesapla açık diğer cihaz/oturumlarını da geçersiz kılar.
 * Yalnızca bu cihazdaki oturum kapatılmalı, diğerleri etkilenmemeli.
 * redirectTo: personel/misafir dışındaki yüzeyler (Süper Admin) kendi
 * login sayfasına yönlendirebilsin diye parametreleştirildi (Faz 4).
 */
export async function signOutCurrentDevice(redirectTo = "/admin/login"): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut({ scope: "local" });
  window.location.assign(redirectTo);
}
