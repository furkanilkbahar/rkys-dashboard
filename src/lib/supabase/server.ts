import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

import type { Database } from "./types";

const STAFF_ROLES = ["owner", "manager", "waiter", "kitchen", "courier"];

// D87'nin ayrı cookie ad alanı (bkz. lib/supabase/waiterClient.ts) — aynı
// tarayıcıda owner/manager'ın kendi admin oturumuyla, garsonun PIN
// oturumunun bağımsız yaşayabilmesi için.
const WAITER_COOKIE_NAME = "sb-waiter-auth-token";

function buildClient(cookieStore: Awaited<ReturnType<typeof cookies>>, cookieName?: string) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cookieName ? { cookieOptions: { name: cookieName } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Server Components can't write cookies; the middleware refreshes
          // the session on every request, so this is a safe no-op here.
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // ignore
          }
        },
      },
    },
  );
}

/**
 * D87: cookie'ler sekme değil TARAYICI/origin bazlı olduğundan, aynı
 * tarayıcıda owner'ın admin oturumu VE garsonun PIN oturumu (ayrı cookie adı
 * — waiterClient.ts) her isteğe birlikte eklenir. Hangi oturumun
 * ÖNCELİKLİ sayılacağı yüzeye göre değişir — proxy.ts, yalnızca /waiter
 * altındaki isteklere `x-rkys-prefer-waiter-session` header'ı ekler:
 * - /waiter dışındaki HER yüzeyde (admin/cashier/kitchen/menu/vs.) davranış
 *   birebir korunur: varsayılan cookie'de personel oturumu var mı bakılır,
 *   yoksa (misafirin Anonymous Auth oturumu dahil) varsayılan client
 *   olduğu gibi döner.
 * - /waiter altında ÖNCE garson PIN oturumu denenir (o sekmenin/cihazın asıl
 *   sahibi); yoksa varsayılan cookie'ye (owner/manager kendi oturumuyla
 *   /waiter'a girdiğinde) düşülür.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const preferWaiterSession = headerStore.get("x-rkys-prefer-waiter-session") === "1";

  const defaultClient = buildClient(cookieStore);
  const waiterClient = buildClient(cookieStore, WAITER_COOKIE_NAME);

  async function staffRole(client: ReturnType<typeof buildClient>): Promise<string | null> {
    const { data } = await client.auth.getClaims();
    const role = data ? (data.claims as Record<string, unknown>).user_role : null;
    return typeof role === "string" && STAFF_ROLES.includes(role) ? role : null;
  }

  const [first, second] = preferWaiterSession ? [waiterClient, defaultClient] : [defaultClient, waiterClient];

  if (await staffRole(first)) {
    return first;
  }
  if (await staffRole(second)) {
    return second;
  }
  return defaultClient;
}

export function createServiceRoleClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // service_role client never handles user sessions.
        },
      },
    },
  );
}
