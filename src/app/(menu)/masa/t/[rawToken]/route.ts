import { NextResponse } from "next/server";

import { bootstrapGuestSessionForTable } from "@/lib/guest/bootstrap";
import { hashToken } from "@/lib/qr/token";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Masa QR bootstrap: token → tables (service_role, hash lookup) → misafir
 * oturumu (bkz. bootstrapGuestSessionForTable). RULES #7: URL'de yalnızca
 * tahmin edilemez ham token taşınır, masa id'si hiçbir yerde açığa çıkmaz.
 */
export async function GET(request: Request, { params }: { params: Promise<{ rawToken: string }> }) {
  const { rawToken } = await params;
  const tokenHash = hashToken(rawToken);

  // request.url'in host kısmı yerine Host header'ından inşa edilir — dev
  // sunucusunda *.localhost subdomain'leri request.url'de kayboluyor, Host
  // header her zaman gerçek olanı taşır (protokol yine request.url'den).
  const base = `${new URL(request.url).protocol}//${request.headers.get("host")}`;

  const service = createServiceRoleClient();
  const { data: table } = await service
    .from("tables")
    .select("id")
    .eq("qr_token_hash", tokenHash)
    .eq("is_active", true)
    .maybeSingle();

  if (!table) {
    return NextResponse.redirect(new URL("/masa/gecersiz", base));
  }

  const ok = await bootstrapGuestSessionForTable(table.id);
  return NextResponse.redirect(new URL(ok ? "/masa" : "/masa/gecersiz", base));
}
