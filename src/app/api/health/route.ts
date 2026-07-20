import { NextResponse } from "next/server";

import { getCurrentTenant } from "@/lib/data/tenant";

export async function GET() {
  const tenant = await getCurrentTenant();
  return NextResponse.json({ status: "ok", tenant });
}
