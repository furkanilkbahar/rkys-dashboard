import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import type { Database } from "@/lib/supabase/types";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN!;

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  if (host === ROOT_DOMAIN) {
    // Kök domain: marketing/platform yüzeyleri, tenant context'i yok.
    return updateSession(request, NextResponse.next());
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
  requestHeaders.set("x-rkys-tenant-currency", tenant.tenant_currency);
  requestHeaders.set("x-rkys-tenant-theme", tenant.tenant_theme_key);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return updateSession(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
