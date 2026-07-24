import { NextResponse } from "next/server";

import { getCurrentTenant } from "@/lib/data/tenant";
import { bootstrapDeliverySession } from "@/lib/guest/bootstrap";

/** paket/baslat/route.ts'in delivery karşılığı. */
export async function GET(request: Request) {
  const base = `${new URL(request.url).protocol}//${request.headers.get("host")}`;
  const tenant = await getCurrentTenant();

  if (!tenant) {
    return NextResponse.redirect(new URL("/teslimat/gecersiz", base));
  }

  const tableSessionId = await bootstrapDeliverySession(tenant.id);
  return NextResponse.redirect(new URL(tableSessionId ? "/teslimat" : "/teslimat/gecersiz", base));
}
