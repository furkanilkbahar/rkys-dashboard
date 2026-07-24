import { NextResponse } from "next/server";

import { authenticateApiRequest } from "@/lib/api/auth";
import { getApiOrders } from "@/lib/api/queries";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  const orders = await getApiOrders(auth.tenantId, limit);
  return NextResponse.json({ data: orders });
}
