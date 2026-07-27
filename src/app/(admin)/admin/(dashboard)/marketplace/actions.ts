"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentActor } from "@/lib/auth/session";
import { mappingFormSchema, type MarketplaceActionResult } from "@/lib/marketplace/schemas";
import { isEnabled } from "@/lib/modules/isEnabled";
import { createClient } from "@/lib/supabase/server";

export async function createMapping(input: unknown): Promise<MarketplaceActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (actor.role !== "owner") return { ok: false, error: "forbidden" };
  if (!(await isEnabled(actor.tenantId, "marketplace"))) return { ok: false, error: "not_enabled" };

  const parsed = mappingFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();

  // product_id salt FK ile doğrulanıyordu (products tablosunda VAR OLMASI
  // yeterliydi) — RLS'in görmediği (BAŞKA tenant'a ait) bir product_id
  // eşlenip, marketplace ingest'i o tenant'ın ürününü sessizce sızdırabilirdi
  // (RULES #2). Burada açıkça bu tenant'a ait olduğu doğrulanır.
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", parsed.data.productId)
    .eq("tenant_id", actor.tenantId)
    .maybeSingle();
  if (!product) return { ok: false, error: "invalid_input" };

  const { error } = await supabase.from("product_external_mappings").insert({
    tenant_id: actor.tenantId,
    provider: parsed.data.provider,
    external_sku: parsed.data.externalSku,
    product_id: parsed.data.productId,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/marketplace");
  return { ok: true };
}

export async function deleteMapping(mappingId: string): Promise<MarketplaceActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (actor.role !== "owner") return { ok: false, error: "forbidden" };
  if (!z.uuid().safeParse(mappingId).success) return { ok: false, error: "unknown" };

  const supabase = await createClient();
  const { error } = await supabase.from("product_external_mappings").delete().eq("id", mappingId).eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/marketplace");
  return { ok: true };
}
