import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateApiRequest } from "@/lib/api/auth";
import { getApiOrders } from "@/lib/api/queries";

const limitSchema = z.coerce.number().int().min(1).max(200).optional();

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limitParam = new URL(request.url).searchParams.get("limit");
  const parsedLimit = limitSchema.safeParse(limitParam ?? undefined);
  if (!parsedLimit.success) {
    return NextResponse.json({ error: "invalid_limit" }, { status: 400 });
  }

  const orders = await getApiOrders(auth.tenantId, parsedLimit.data);
  return NextResponse.json({ data: orders });
}
