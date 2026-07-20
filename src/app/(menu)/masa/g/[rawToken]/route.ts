import { NextResponse } from "next/server";

import { hashToken } from "@/lib/qr/token";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Genel QR: doğrudan oturum açmaz — RULES #32 gereği önce masa seçimi
 * zorunludur. Token geçerliyse yalnızca seçim sayfasına yönlendirir.
 */
export async function GET(request: Request, { params }: { params: Promise<{ rawToken: string }> }) {
  const { rawToken } = await params;
  const tokenHash = hashToken(rawToken);

  // bkz. masa/t/[rawToken]/route.ts — Host header'ı request.url'den daha
  // güvenilir (dev sunucusunda *.localhost subdomain'i request.url'de kayboluyor).
  const base = `${new URL(request.url).protocol}//${request.headers.get("host")}`;

  const service = createServiceRoleClient();
  const { data: generic } = await service
    .from("generic_qr_codes")
    .select("id")
    .eq("qr_token_hash", tokenHash)
    .eq("is_active", true)
    .maybeSingle();

  if (!generic) {
    return NextResponse.redirect(new URL("/masa/gecersiz", base));
  }

  const url = new URL("/masa/secim", base);
  url.searchParams.set("g", rawToken);
  return NextResponse.redirect(url);
}
