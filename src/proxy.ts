import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import type { Database } from "@/lib/supabase/types";
import { resolveSurface, SURFACE_HEADER } from "@/themes/surface";

// Vercel'de tek deployment'a birden fazla *.vercel.app alias'ı bağlanabiliyor
// (proje/takım adı değişiklikleri, yeniden adlandırmalar birikiyor) — hepsi
// kök domain (marketing/platform) sayılmalı. ROOT_DOMAINS virgülle ayrılmış
// liste kabul eder; yoksa geriye dönük tekil NEXT_PUBLIC_ROOT_DOMAIN'e düşer
// (yerel geliştirme: "localhost:3000").
const ROOT_DOMAINS = new Set(
  (process.env.ROOT_DOMAINS ?? process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "")
    .split(",")
    .map((domain) => domain.trim())
    .filter(Boolean),
);

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  if (ROOT_DOMAINS.has(host)) {
    // Kök domain: marketing/platform yüzeyleri, tenant context'i yok.
    // D88: tenant teması olmasa da token yüzeyi belirtilmeli — kök layout
    // `data-surface`'i buradan okur (marketing vs. platform chrome'u).
    const rootHeaders = new Headers(request.headers);
    rootHeaders.set(SURFACE_HEADER, resolveSurface(request.nextUrl.pathname, true));
    return updateSession(request, NextResponse.next({ request: { headers: rootHeaders } }));
  }

  const anon = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data, error } = await anon.rpc("resolve_tenant_by_domain", { p_domain: host });
  const tenant = data?.[0];

  if (error || !tenant || tenant.tenant_status !== "active") {
    const url = request.nextUrl.clone();
    url.pathname = "/tenant-not-found";
    return NextResponse.rewrite(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-rkys-tenant-id", tenant.tenant_id);
  requestHeaders.set("x-rkys-tenant-slug", tenant.tenant_slug);
  requestHeaders.set("x-rkys-tenant-name", tenant.tenant_name);
  requestHeaders.set("x-rkys-tenant-currency", tenant.tenant_currency);
  requestHeaders.set("x-rkys-tenant-theme", tenant.tenant_theme_key);
  // D88: tenant subdomain'inde misafir menüsü tenant temasını (Katman 1),
  // personel yüzeyleri RKYS uygulama chrome'unu (Katman 2b) alır. Tenant
  // token'ı `data-surface="app"` altında hiç eşleşmez — sızıntı burada kesilir.
  requestHeaders.set(SURFACE_HEADER, resolveSurface(request.nextUrl.pathname, false));
  // D87: /waiter yüzeyinde, aynı tarayıcıda hem owner'ın admin oturumu hem
  // garsonun PIN oturumu (ayrı cookie) aynı anda mevcut olabilir — ikisi de
  // her isteğe eklenir (cookie'ler sekme değil, origin bazlıdır). /waiter
  // altında garson cookie'si ÖNCELİKLİDİR (bkz. lib/supabase/server.ts);
  // diğer tüm yüzeylerde (admin/cashier/kitchen) davranış değişmez.
  if (request.nextUrl.pathname.startsWith("/waiter")) {
    requestHeaders.set("x-rkys-prefer-waiter-session", "1");
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return updateSession(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
