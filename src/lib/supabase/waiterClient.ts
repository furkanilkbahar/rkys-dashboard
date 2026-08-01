import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./types";

// D87: garson panelinin PIN girişi (bkz. lib/auth/waiterGuard.ts) admin
// panelle AYNI tarayıcıda kullanılabilmeli, owner'ın Supabase Auth
// oturumunu bozmadan — bu yüzden farklı bir cookie ADI altında tamamen
// bağımsız bir oturum saklanır (aynı isimde farklı Path denemesi
// tarayıcılarda güvenilir şekilde ayrışmaz, farklı isim şart). RLS/RPC
// katmanına hiç dokunulmaz: bu, tıpatıp aynı createClient()'ın yalnızca
// farklı bir cookie ad alanına yazan bir kopyası.
const WAITER_COOKIE_NAME = "sb-waiter-auth-token";

export async function createWaiterClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: WAITER_COOKIE_NAME },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // ignore — see lib/supabase/server.ts'teki aynı yorum
          }
        },
      },
    },
  );
}
