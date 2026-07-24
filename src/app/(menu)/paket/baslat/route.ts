import { NextResponse } from "next/server";

import { getCurrentTenant } from "@/lib/data/tenant";
import { bootstrapPickupSession } from "@/lib/guest/bootstrap";

/**
 * Gel-Al bootstrap: masa QR'ının (t/[rawToken]/route.ts) aksine token yok —
 * tenant middleware'den (x-rkys-tenant-id) okunur. RULES #34: pickup modülü
 * kapalıysa open_pickup_session zaten reddeder, /paket/gecersiz'e düşülür.
 */
export async function GET(request: Request) {
  const base = `${new URL(request.url).protocol}//${request.headers.get("host")}`;
  const tenant = await getCurrentTenant();

  if (!tenant) {
    return NextResponse.redirect(new URL("/paket/gecersiz", base));
  }

  const tableSessionId = await bootstrapPickupSession(tenant.id);
  return NextResponse.redirect(new URL(tableSessionId ? "/paket" : "/paket/gecersiz", base));
}
