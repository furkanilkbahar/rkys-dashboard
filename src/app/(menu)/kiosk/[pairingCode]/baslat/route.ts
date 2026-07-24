import { NextResponse } from "next/server";

import { getCurrentTenant } from "@/lib/data/tenant";
import { bootstrapKioskSession } from "@/lib/guest/bootstrap";

/**
 * Kiosk bootstrap: tablet bu ucu açar (pairing_code URL'de) → tenant
 * middleware'den (x-rkys-tenant-id) okunur → open_kiosk_session pairing
 * code'u doğrular → /paket'e yönlendirilir (kod yeniden kullanımı, bkz.
 * guest/bootstrap.ts yorumu). Geçersiz kod/kapalı modül → /kiosk/[code]/gecersiz.
 */
export async function GET(request: Request, { params }: { params: Promise<{ pairingCode: string }> }) {
  const base = `${new URL(request.url).protocol}//${request.headers.get("host")}`;
  const { pairingCode } = await params;
  const tenant = await getCurrentTenant();

  if (!tenant) {
    return NextResponse.redirect(new URL(`/kiosk/${pairingCode}/gecersiz`, base));
  }

  const tableSessionId = await bootstrapKioskSession(tenant.id, pairingCode);
  return NextResponse.redirect(new URL(tableSessionId ? "/paket" : `/kiosk/${pairingCode}/gecersiz`, base));
}
